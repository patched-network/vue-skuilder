function(newDoc, oldDoc, userCtx, secObj) {
  // Skip validation for deletions
  if (newDoc._deleted) return;
  
  // Always allow admins to do anything
  if (userCtx.roles.indexOf('_admin') !== -1) return;
  
  // For CourseConfig document - we need special handling
  if (newDoc._id === 'CourseConfig') {
    // Allow the creator or admins listed in the document to modify it
    if (oldDoc && oldDoc.creator === userCtx.name) return;
    if (oldDoc && oldDoc.admins && Array.isArray(oldDoc.admins) && oldDoc.admins.indexOf(userCtx.name) !== -1) return;
    
    // For updates, if user is not creator or admin, deny
    if (oldDoc) {
      throw({forbidden: "Only course creator or admins can modify course configuration"});
    }
    
    // For new course config, allow (initial creation is secured at API level)
    return;
  }
  
  // For all other documents
  var isAdmin = false;
  var isModerator = false;
  
  // Course admins and moderators can edit anything
  // (Since we can't check CourseConfig directly, we rely on document author for regular docs)
  
  // Document has author field that matches current user - allow
  if (oldDoc && oldDoc.author === userCtx.name) return;
  
  // Allow document creation by any authenticated user
  if (!oldDoc) {
    if (!userCtx.name) {
      throw({forbidden: "You must be logged in to create documents"});
    }
    
    // Ensure new documents have an author field that matches the current user
    if (!newDoc.author || newDoc.author !== userCtx.name) {
      throw({forbidden: "Document author must match your username"});
    }
    
    return;
  }

  // ---------------------------------------------------------------------------
  // Dynamic card ELO: any authenticated user may update an existing CARD doc
  // iff the ONLY thing that changed is 'elo', and the 'elo' change is a
  // single bounded ELO step (see isBoundedEloStep below). This is what lets
  // content difficulty settle from live study traffic without giving learners
  // write access to anything else on the card.
  //
  // ES5 only (CouchDB SpiderMonkey): no let/const/arrow/for-of/Object.entries.
  // ---------------------------------------------------------------------------
  var ELO_MAX_STEP = 64; // must match K_MAX in @vue-skuilder/common elo.ts

  function isPlainObject(x) {
    return x !== null && typeof x === 'object' && !Array.isArray(x);
  }

  // Structural deep equality. Key order is irrelevant (a client round-trip
  // does not preserve it), so never compare serialized JSON.
  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (a === null || b === null) return false;
    if (typeof a !== 'object') {
      // NaN !== NaN; treat two NaNs as equal for robustness
      return a !== a && b !== b;
    }
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i])) return false;
      }
      return true;
    }
    var ka = Object.keys(a);
    var kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (var j = 0; j < ka.length; j++) {
      var k = ka[j];
      if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
      if (!deepEqual(a[k], b[k])) return false;
    }
    return true;
  }

  function isEloRank(r) {
    return isPlainObject(r) && typeof r.score === 'number' && typeof r.count === 'number';
  }

  function isCourseElo(e) {
    return isPlainObject(e) && isEloRank(e.global) && isPlainObject(e.tags);
  }

  // Compare an EloRank 'n' against its predecessor 'o'. Returns null if OK,
  // else a reason string. 'label' names the rank for the message.
  //   - unchanged (score & count equal, other fields equal)  -> OK
  //   - one step: count === old.count + 1, |score delta| <= ELO_MAX_STEP,
  //     every field other than score/count deep-equal            -> OK
  function checkRankStep(label, o, n) {
    if (!isEloRank(n)) return label + ' must have numeric score and count';
    if (!isEloRank(o)) return label + ' has no valid prior rank to step from';
    // Non-bounded fields must be identical
    var keys = Object.keys(n).concat(Object.keys(o));
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === 'score' || k === 'count') continue;
      if (!deepEqual(o[k], n[k])) return label + ': only score and count may change (field "' + k + '")';
    }
    if (n.count === o.count && n.score === o.score) return null; // untouched
    if (n.count !== o.count + 1) {
      return label + ': count must increment by exactly 1 (was ' + o.count + ', got ' + n.count + ')';
    }
    if (Math.abs(n.score - o.score) > ELO_MAX_STEP) {
      return label + ': score may move at most ' + ELO_MAX_STEP + ' per update (was ' + o.score + ', got ' + n.score + ')';
    }
    return null;
  }

  // Compare a tag entry that does not exist on the old doc. The framework
  // initialises a new card-side tag rank at the card's (old) global score
  // with count 0, then applies one step.
  function checkNewRank(label, baseScore, n) {
    if (!isEloRank(n)) return label + ' must have numeric score and count';
    var keys = Object.keys(n);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] !== 'score' && keys[i] !== 'count') {
        return label + ': a new tag rank may only carry score and count (field "' + keys[i] + '")';
      }
    }
    if (n.count !== 1) return label + ': a new tag rank must have count 1 (got ' + n.count + ')';
    if (Math.abs(n.score - baseScore) > ELO_MAX_STEP) {
      return label + ': a new tag rank must start within ' + ELO_MAX_STEP + ' of the card global score ' + baseScore + ' (got ' + n.score + ')';
    }
    return null;
  }

  function isBoundedEloStep(oldElo, newElo) {
    if (!isCourseElo(newElo)) return 'elo must have the CourseElo shape {global:{score,count}, tags:{...}}';
    if (!isCourseElo(oldElo)) return 'existing elo is not CourseElo-shaped; cannot apply a bounded step';

    // Top-level elo keys other than global/tags must be unchanged (e.g. misc)
    var topKeys = Object.keys(newElo).concat(Object.keys(oldElo));
    for (var t = 0; t < topKeys.length; t++) {
      var tk = topKeys[t];
      if (tk === 'global' || tk === 'tags') continue;
      if (!deepEqual(oldElo[tk], newElo[tk])) return 'elo.' + tk + ' may not change';
    }

    var reason = checkRankStep('elo.global', oldElo.global, newElo.global);
    if (reason) return reason;

    // No tag deletions
    var oldTags = Object.keys(oldElo.tags);
    for (var d = 0; d < oldTags.length; d++) {
      if (!Object.prototype.hasOwnProperty.call(newElo.tags, oldTags[d])) {
        return 'elo.tags["' + oldTags[d] + '"] may not be removed';
      }
    }

    var newTags = Object.keys(newElo.tags);
    for (var n = 0; n < newTags.length; n++) {
      var tag = newTags[n];
      var label = 'elo.tags["' + tag + '"]';
      if (Object.prototype.hasOwnProperty.call(oldElo.tags, tag)) {
        reason = checkRankStep(label, oldElo.tags[tag], newElo.tags[tag]);
      } else {
        reason = checkNewRank(label, oldElo.global.score, newElo.tags[tag]);
      }
      if (reason) return reason;
    }
    return null;
  }

  if (newDoc.docType === 'CARD' && oldDoc.docType === 'CARD') {
    if (!userCtx.name) {
      throw({forbidden: "You must be logged in to update card elo"});
    }
    if (newDoc._id !== oldDoc._id) {
      throw({forbidden: "Card elo update: _id may not change"});
    }
    // Every field except elo and revision metadata must be unchanged.
    // _attachments (stubs) IS compared. _rev/_revisions/_conflicts etc. are
    // couch bookkeeping the client may or may not echo back, so skip them.
    var allKeys = Object.keys(newDoc).concat(Object.keys(oldDoc));
    for (var f = 0; f < allKeys.length; f++) {
      var field = allKeys[f];
      if (field === 'elo') continue;
      if (field.charAt(0) === '_' && field !== '_id' && field !== '_attachments') continue;
      if (!deepEqual(oldDoc[field], newDoc[field])) {
        throw({forbidden: 'Card elo update: only the elo field may change (field "' + field + '" differs)'});
      }
    }
    var eloReason = isBoundedEloStep(oldDoc.elo, newDoc.elo);
    if (eloReason) {
      throw({forbidden: 'Card elo update rejected: ' + eloReason});
    }
    return;
  }
  
  // For updates to existing documents, deny if not the original author
  if (oldDoc && oldDoc.author && oldDoc.author !== userCtx.name) {
    throw({forbidden: "You can only modify your own documents"});
  }
  
  // Special case for design documents - only admins can modify (handled above)
  // Use indexOf instead of startsWith for CouchDB SpiderMonkey compatibility (ES5)
  if (newDoc._id.indexOf('_design/') === 0) {
    throw({forbidden: "Only admins can modify design documents"});
  }
}
