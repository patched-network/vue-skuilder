import { CardData, DocType } from '@vue-skuilder/db';
import * as fileSystem from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * Fake fcn to allow usage in couchdb map fcns which, after passing
 * through `.toString()`, are applied to all courses
 */
function emit(key?: unknown, value?: unknown): [unknown, unknown] {
  return [key, value];
}

// Get directory of this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dual resolution strategy for assets
function getAssetPath(assetName: string): string {
  // Strategy 1: Development mode - assets in parent directory
  const devModePath = join(__dirname, '..', 'assets', assetName);
  if (fileSystem.existsSync(devModePath)) {
    return devModePath;
  }
  
  // Strategy 2: Built module mode - assets in same directory
  const moduleModePath = join(__dirname, 'assets', assetName);
  if (fileSystem.existsSync(moduleModePath)) {
    return moduleModePath;
  }
  
  // Fallback error with helpful context
  throw new Error(
    `Asset '${assetName}' not found. Tried:\n` +
    `  Dev mode: ${devModePath}\n` +
    `  Module mode: ${moduleModePath}\n` +
    `  Current __dirname: ${__dirname}`
  );
}

// Load design documents with dual resolution
export const classroomDbDesignDoc = fileSystem.readFileSync(
  getAssetPath('classroomDesignDoc.js'),
  'utf-8'
);

export const courseDBDesignDoc = fileSystem.readFileSync(
  getAssetPath('get-tagsDesignDoc.json'),
  'utf-8'
);

export const courseValidateDocUpdate = fileSystem.readFileSync(
  getAssetPath('courseValidateDocUpdate.js'),
  'utf-8'
);

export const elodoc = {
  _id: '_design/elo',
  views: {
    elo: {
      map: `function (doc) {
                if (doc.docType && doc.docType === 'CARD') {
                    if (doc.elo && typeof(doc.elo) === 'number') {
                        emit(doc.elo, doc._id);
                    } else if (doc.elo && doc.elo.global) {
                        emit(doc.elo.global.score, doc._id);
                    } else if (doc.elo) {
                        emit(doc.elo.score, doc._id);
                    } else {
                        const randElo = 995 + Math.round(10 * Math.random());
                        emit(randElo, doc._id);
                    }
                }
            }`,
    },
  },
  language: 'javascript',
};

export const tagsDoc = {
  _id: '_design/getTags',
  views: {
    getTags: {
      map: `function (doc) {
                if (doc.docType && doc.docType === "TAG") {
                    for (var cardIndex in doc.taggedCards) {
                        emit(doc.taggedCards[cardIndex], {
                            docType: doc.docType,
                            name: doc.name,
                            snippit: doc.snippit,
                            wiki: '',
                            taggedCards: []
                        });
                    }
                }
            }`,
    },
  },
  language: 'javascript',
};

export const cardsByInexperienceDoc = {
  _id: '_design/cardsByInexperience',
  views: {
    cardsByInexperience: {
      map: function (doc: CardData) {
        if (doc.docType && doc.docType === DocType.CARD) {
          if (
            doc.elo &&
            doc.elo.global &&
            typeof doc.elo.global.count == 'number'
          ) {
            emit(doc.elo.global.count, doc.elo);
          } else if (doc.elo && typeof doc.elo == 'number') {
            emit(0, doc.elo);
          } else {
            emit(0, 995 + Math.floor(10 * Math.random()));
          }
        }
      }.toString(),
    },
  },
  language: 'javascript',
};

export const authDesignDoc = {
  _id: '_design/_auth',
  validate_doc_update: courseValidateDocUpdate,
};

export const courseDBDesignDocs = [
  elodoc,
  tagsDoc,
  cardsByInexperienceDoc,
  authDesignDoc,
];
