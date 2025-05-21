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
  
  // For updates to existing documents, deny if not the original author
  if (oldDoc && oldDoc.author && oldDoc.author !== userCtx.name) {
    throw({forbidden: "You can only modify your own documents"});
  }
  
  // Special case for design documents - only admins can modify (handled above)
  if (newDoc._id.startsWith('_design/')) {
    throw({forbidden: "Only admins can modify design documents"});
  }
}