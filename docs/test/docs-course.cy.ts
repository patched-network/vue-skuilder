/**
 * Smoke test for the docs course (dbg/docs-course): the gate filter is assembled into the
 * course's pipeline, holds back questions for unread pages, and opens and boosts a page's
 * questions once it has been read.
 *
 * Assertions read the pipeline's own run reports (window.skuilder.pipeline.runs), so they check
 * selection rather than rendering.
 */

const COURSE_ID = 'skuilder-docs';
const READING_KEY = 'skuilder-docs:reading';

type Run = {
  courseId: string;
  filters: Array<{ name: string; boosted: number; penalized: number }>;
  cards: Array<{
    cardId: string;
    selected: boolean;
    tags?: string[];
    provenance: Array<{ strategy: string; action: string; reason: string }>;
  }>;
};

function wipeBrowserState() {
  // A page with no embedded course, so no PouchDB handle blocks deletion.
  cy.visit('/vue-skuilder/dbg/');
  cy.window().then(async (win) => {
    win.localStorage.clear();
    const dbs = await win.indexedDB.databases();
    await Promise.all(
      dbs.map(
        (d) =>
          new Promise((resolve) => {
            const req = win.indexedDB.deleteDatabase(d.name!);
            req.onsuccess = req.onerror = req.onblocked = () => resolve(null);
          })
      )
    );
  });
}

function startSessionAndGetFirstRun(): Cypress.Chainable<Run> {
  cy.contains('button', 'Start Session', { timeout: 60000 }).should('be.visible').click();
  return cy
    .window()
    .its('skuilder.pipeline.runs', { timeout: 60000 })
    .should((runs: Run[]) => {
      expect(runs.some((r) => r.courseId === COURSE_ID)).to.equal(true);
    })
    .then((runs: Run[]) => runs.filter((r) => r.courseId === COURSE_ID)[0]);
}

const exerciseSection = (tags: string[] = []) =>
  tags.map((t) => /^docs:exercise:(.+)$/.exec(t)?.[1]).find(Boolean);

describe('Docs course (prototype)', () => {
  beforeEach(() => wipeBrowserState());

  it('with nothing read, serves only open sections and intros', () => {
    cy.visit('/vue-skuilder/dbg/docs-course.html');
    cy.contains('1 of 9 sections open', { timeout: 60000 });

    startSessionAndGetFirstRun().then((run) => {
      const gate = run.filters.find((f) => f.name === 'Docs reading gate');
      expect(gate, 'gate filter assembled into the pipeline').to.exist;
      expect(gate!.penalized, 'gate held some cards back').to.be.greaterThan(0);

      const selected = run.cards.filter((c) => c.selected);
      expect(selected.length).to.be.greaterThan(0);
      for (const c of selected) {
        const section = exerciseSection(c.tags);
        if (section) expect(section, `selected question ${c.cardId}`).to.equal('start');
      }
    });
  });

  it('records responses against the course (registration under its ID, ratings update)', () => {
    const errors: string[] = [];
    const logs: string[] = [];
    cy.visit('/vue-skuilder/dbg/docs-course.html', {
      onBeforeLoad(win) {
        const err = win.console.error.bind(win.console);
        const log = win.console.log.bind(win.console);
        cy.stub(win.console, 'error').callsFake((...a: unknown[]) => {
          errors.push(a.map(String).join(' '));
          err(...a);
        });
        cy.stub(win.console, 'log').callsFake((...a: unknown[]) => {
          logs.push(a.map(String).join(' '));
          log(...a);
        });
      },
    });
    startSessionAndGetFirstRun();

    // Answer a few cards correctly, looking each answer up in the course's own data:
    // "Next" on an info card, otherwise the option matching the answer.
    const answers = new Map<string, string>();
    cy.request('/vue-skuilder/static-courses/skuilder-docs/chunks/DISPLAYABLE_DATA-0000.json').then(
      (res) => {
        for (const dd of res.body as Array<{ _id: string; data: Array<{ name: string; data?: string }> }>) {
          const md = dd.data.find((f) => f.name === 'Input')?.data ?? '';
          const m = /\{\{([^|}]*)\|\|/.exec(md);
          if (m) answers.set(dd._id.replace(/^dd-/, 'c-'), m[1].trim());
        }
      }
    );
    const step = (n: number) => {
      if (n === 0) return;
      cy.wait(2500);
      cy.window().then((w: any) => {
        const pres = w.skuilder?.session?.active?.presentations ?? [];
        const current: string = pres[pres.length - 1]?.cardId ?? '';
        cy.get('body').then(($body) => {
          const next = $body.find('.study-container button:contains("Next")');
          const answer = answers.get(current);
          const choice = $body.find('.study-container .choice').filter((_, el) => el.textContent?.trim() === answer);
          if (next.length) cy.wrap(next.first()).click();
          else if (choice.length) cy.wrap(choice.first()).click();
        });
      });
      step(n - 1);
    };
    step(6);

    cy.window()
      .its('skuilder.session.active.presentations')
      .should('have.length.greaterThan', 2)
      .then((presentations: Array<{ cardId?: string }>) => {
        const ids = presentations.map((p) => p.cardId ?? '');
        expect(ids.some((id) => id.startsWith('c-skdocs-start-')), 'a question was answered').to.equal(true);
        expect(logs.some((l) => l.includes(`Auto-registering user for course: ${COURSE_ID}`))).to.equal(true);
        expect(errors.filter((e) => e.includes('No registration for course'))).to.deep.equal([]);
      });
  });

  it('opens and boosts the questions of a page once it is read', () => {
    cy.visit('/vue-skuilder/dbg/docs-course.html', {
      onBeforeLoad(win) {
        win.localStorage.setItem(
          READING_KEY,
          JSON.stringify({
            pages: { 'learn/pedagogy': { readAt: new Date().toISOString() } },
            updatedAt: new Date().toISOString(),
          })
        );
      },
    });
    cy.contains('2 of 9 sections open', { timeout: 60000 });

    startSessionAndGetFirstRun().then((run) => {
      const selected = run.cards.filter((c) => c.selected);
      const pedagogy = selected.filter((c) => exerciseSection(c.tags) === 'pedagogy');
      expect(pedagogy.length, 'pedagogy questions selected').to.be.greaterThan(0);
      for (const c of pedagogy) {
        const step = c.provenance.find((p) => p.strategy === 'docsReadingGate');
        expect(step?.action, `gate on ${c.cardId}`).to.equal('boosted');
      }
      for (const c of selected) {
        const section = exerciseSection(c.tags);
        if (section) expect(['start', 'pedagogy']).to.include(section);
      }
    });
  });
});
