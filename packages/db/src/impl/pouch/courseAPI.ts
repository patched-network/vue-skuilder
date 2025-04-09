import pouch from 'pouchdb-browser';
import { pouchDBincludeCredentialsConfig } from '.';
import { ENV } from '@vue-skuilder/common';
// import { DataShape } from '../..base-course/Interfaces/DataShape';
import { NameSpacer, ShapeDescriptor } from '@vue-skuilder/common';
import { CourseConfig, DataShape } from '@vue-skuilder/common';
import { CourseElo, blankCourseElo, toCourseElo } from '@vue-skuilder/common';
import { CourseDB, createTag, updateCardElo } from './courseDB';
import { CardData, DisplayableData, DocType, Tag } from '../../core/types/types-legacy';
import { prepareNote55 } from '@vue-skuilder/common';
import { User } from './userDB';

/**
 *
 * @param courseID id of the course (quilt) being added to
 * @param codeCourse
 * @param shape
 * @param data the datashape data - data required for this shape
 * @param author
 * @param uploads optional additional media uploads: img0, img1, ..., aud0, aud1,...
 * @returns
 */
export async function addNote55(
  courseID: string,
  codeCourse: string,
  shape: DataShape,
  data: unknown,
  author: string,
  tags: string[],
  uploads?: { [x: string]: PouchDB.Core.FullAttachment },
  elo: CourseElo = blankCourseElo()
) {
  const db = getCourseDB(courseID);
  const payload = prepareNote55(courseID, codeCourse, shape, data, author, tags, uploads);
  const result = await db.post<DisplayableData>(payload);

  const dataShapeId = NameSpacer.getDataShapeString({
    course: codeCourse,
    dataShape: shape.name,
  });

  if (result.ok) {
    // create cards
    await createCards(courseID, dataShapeId, result.id, tags, elo);
  } else {
    console.log(`Error adding note: ${result}`);
  }

  return result;
}

export async function createCards(
  courseID: string,
  datashapeID: PouchDB.Core.DocumentId,
  noteID: PouchDB.Core.DocumentId,
  tags: string[],
  elo: CourseElo = blankCourseElo()
) {
  const cfg = await getCredentialledCourseConfig(courseID);
  const dsDescriptor = NameSpacer.getDataShapeDescriptor(datashapeID);
  let questionViewTypes: string[] = [];

  for (const ds of cfg.dataShapes) {
    if (ds.name === datashapeID) {
      questionViewTypes = ds.questionTypes;
    }
  }

  for (const questionView of questionViewTypes) {
    createCard(questionView, courseID, dsDescriptor, noteID, tags, elo);
  }
}

async function createCard(
  questionViewName: string,
  courseID: string,
  dsDescriptor: ShapeDescriptor,
  noteID: string,
  tags: string[],
  elo: CourseElo = blankCourseElo()
) {
  tags.forEach((t) => console.log(`Adding ${t}!`));
  const qDescriptor = NameSpacer.getQuestionDescriptor(questionViewName);
  const cfg = await getCredentialledCourseConfig(courseID);

  for (const rQ of cfg.questionTypes) {
    if (rQ.name === questionViewName) {
      for (const view of rQ.viewList) {
        addCard(
          courseID,
          dsDescriptor.course,
          [noteID],
          NameSpacer.getViewString({
            course: qDescriptor.course,
            questionType: qDescriptor.questionType,
            view,
          }),
          elo,
          tags
        );
      }
    }
  }
}

/**
 *
 * Adds a card to the DB. This function is called
 * as a side effect of adding either a View or
 * DisplayableData item.
 * @param course The name of the course that the card belongs to
 * @param id_displayable_data C/PouchDB ID of the data used to hydrate the view
 * @param id_view C/PouchDB ID of the view used to display the card
 *
 * @package
 */
async function addCard(
  courseID: string,
  course: string,
  id_displayable_data: PouchDB.Core.DocumentId[],
  id_view: PouchDB.Core.DocumentId,
  elo: CourseElo,
  tags: string[]
) {
  const card = await getCourseDB(courseID).post<CardData>({
    course,
    id_displayable_data,
    id_view,
    docType: DocType.CARD,
    elo: elo || toCourseElo(990 + Math.round(20 * Math.random())),
  });
  tags.forEach((tag) => {
    console.log(`adding tag: ${tag} to card ${card.id}`);
    addTagToCard(courseID, card.id, tag, false);
  });
  return card;
}

export async function getCredentialledCourseConfig(courseID: string): Promise<CourseConfig> {
  try {
    const db = getCourseDB(courseID);
    const ret = await db.get<CourseConfig>('CourseConfig');
    ret.courseID = courseID;
    console.log(`Returning course config: ${JSON.stringify(ret)}`);
    return ret;
  } catch (e) {
    console.error(`Error fetching config for ${courseID}:`, e);
    throw e;
  }
}

/**
 Assciates a tag with a card.

 NB: DB stores tags as separate documents, with a list of card IDs.
     Consider renaming to `addCardToTag` to reflect this.

 NB: tags are created if they don't already exist

 @param updateELO whether to update the ELO of the card with the new tag. Default true.
 @package
*/
export async function addTagToCard(
  courseID: string,
  cardID: string,
  tagID: string,
  updateELO: boolean = true
): Promise<PouchDB.Core.Response> {
  // todo: possible future perf. hit if tags have large #s of taggedCards.
  // In this case, should be converted to a server-request
  const prefixedTagID = getTagID(tagID);
  const courseDB = getCourseDB(courseID);
  const courseApi = new CourseDB(courseID, async () => User.Dummy());
  try {
    console.log(`Applying tag ${tagID} to card ${courseID + '-' + cardID}...`);
    const tag = await courseDB.get<Tag>(prefixedTagID);
    if (!tag.taggedCards.includes(cardID)) {
      tag.taggedCards.push(cardID);

      if (updateELO) {
        courseApi.getCardEloData([cardID]).then((eloData) => {
          const elo = eloData[0];
          elo.tags[tagID] = {
            count: 0,
            score: elo.global.score, // todo: or 1000?
          };
          updateCardElo(courseID, cardID, elo);
        });
      }

      return courseDB.put<Tag>(tag);
    } else throw new AlreadyTaggedErr(`Card ${cardID} is already tagged with ${tagID}`);
  } catch (e) {
    if (e instanceof AlreadyTaggedErr) {
      console.warn(e.message);
      throw e;
    }

    console.log(`Tag ${tagID} does not exist...`);
    await createTag(courseID, tagID);
    return addTagToCard(courseID, cardID, tagID, updateELO);
  }
}

class AlreadyTaggedErr extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AlreadyTaggedErr';
  }
}

export function getTagID(tagName: string): string {
  const tagPrefix = DocType.TAG.valueOf() + '-';
  if (tagName.indexOf(tagPrefix) === 0) {
    return tagName;
  } else {
    return tagPrefix + tagName;
  }
}

export function getCourseDB(courseID: string): PouchDB.Database {
  const dbName = `coursedb-${courseID}`;
  return new pouch(
    ENV.COUCHDB_SERVER_PROTOCOL + '://' + ENV.COUCHDB_SERVER_URL + dbName,
    pouchDBincludeCredentialsConfig
  );
}
