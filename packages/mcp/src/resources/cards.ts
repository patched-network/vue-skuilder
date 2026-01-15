import type { CourseDBInterface } from '@vue-skuilder/db';
import { z } from 'zod';
import { isSuccessRow } from '../utils/index.js';

// Types for card resources
export interface CardResourceData {
  cardId: string;
  datashape: string;
  data: any;
  tags: string[];
  elo?: number;
  created?: string;
  modified?: string;
}

export interface CardsCollection {
  cards: CardResourceData[];
  total: number;
  page?: number;
  limit?: number;
  filter?: string;
}

/**
 * Helper to transform Card entities to CardResourceData
 * Handles the indirection: Card entity (c-...) -> Data document (dd-...)
 */
async function transformCardsToResourceData(
  courseDB: CourseDBInterface,
  cardIds: string[],
  eloMap: Map<any, number>
): Promise<CardResourceData[]> {
  if (cardIds.length === 0) return [];

  // Fetch Card entities (c-... IDs)
  const cardDocs = await courseDB.getCourseDocs(cardIds);

  // Extract data document IDs from Card entities
  const dataDocIds: string[] = [];
  const cardToDataMap = new Map<string, string>(); // cardId -> dataDocId

  for (const row of cardDocs.rows) {
    if (isSuccessRow(row)) {
      const cardDoc = row.doc as any;
      const cardId = cardDoc._id;
      const dataIds = cardDoc.id_displayable_data;

      if (dataIds && dataIds.length > 0) {
        const dataDocId = dataIds[0]; // Take first data document
        dataDocIds.push(dataDocId);
        cardToDataMap.set(cardId, dataDocId);
      }
    }
  }

  // Fetch all data documents
  const dataDocs = dataDocIds.length > 0
    ? await courseDB.getCourseDocs(dataDocIds)
    : { rows: [] };

  // Create map of dataDocId -> data document
  const dataDocMap = new Map<string, any>();
  for (const row of dataDocs.rows) {
    if (isSuccessRow(row)) {
      dataDocMap.set(row.doc._id, row.doc);
    }
  }

  // Transform to CardResourceData format
  const cards: CardResourceData[] = [];
  for (const row of cardDocs.rows) {
    if (isSuccessRow(row)) {
      const cardDoc = row.doc as any;
      const cardId = cardDoc._id;
      const dataDocId = cardToDataMap.get(cardId);
      const dataDoc = dataDocId ? dataDocMap.get(dataDocId) : null;

      cards.push({
        cardId: cardId,
        datashape: dataDoc?.id_datashape || 'unknown',
        data: dataDoc?.data || {},
        tags: [], // Tags are stored separately in TAG documents
        elo: eloMap.get(cardId) || cardDoc.elo?.global?.score || 1500,
        created: cardDoc.created,
        modified: cardDoc.modified
      });
    }
  }

  return cards;
}

// Schema for ELO range parsing
const EloRangeSchema = z.object({
  min: z.number().min(0).max(5000),
  max: z.number().min(0).max(5000)
}).refine(data => data.min <= data.max, {
  message: "Min ELO must be less than or equal to max ELO"
});

/**
 * Handle cards://all resource - List all cards in the course
 */
export async function handleCardsAllResource(
  courseDB: CourseDBInterface,
  limit: number = 50,
  offset: number = 0
): Promise<CardsCollection> {
  try {
    // First, get total count of card entities
    const countResult = await (courseDB as any).db.allDocs({
      startkey: 'c-',
      endkey: 'c-\ufff0',
      include_docs: false
      // No limit - get all IDs to count them
    });
    const totalCards = countResult.rows.length;

    // Now get the paginated card IDs
    const allCardsResult = await (courseDB as any).db.allDocs({
      startkey: 'c-',
      endkey: 'c-\ufff0',
      include_docs: true,  // Include docs so we can debug
      skip: offset,
      limit: limit
    });

    const cardIds = allCardsResult.rows.map((row: any) => row.id);

    if (cardIds.length === 0) {
      return {
        cards: [],
        total: totalCards,
        page: Math.floor(offset / limit) + 1,
        limit,
        filter: 'all'
      };
    }

    // Extract data document IDs from the Card entities we already fetched
    const dataDocIds: string[] = [];
    const cardToDataMap = new Map<string, string>();

    for (const row of allCardsResult.rows) {
      const cardDoc = row.doc as any;
      const dataIds = cardDoc.id_displayable_data;
      if (dataIds && dataIds.length > 0) {
        const dataDocId = dataIds[0];
        dataDocIds.push(dataDocId);
        cardToDataMap.set(cardDoc._id, dataDocId);
      }
    }

    // Fetch data documents
    const dataDocs = dataDocIds.length > 0
      ? await courseDB.getCourseDocs(dataDocIds, { include_docs: true })
      : { rows: [] };

    // Create map of dataDocId -> data document
    const dataDocMap = new Map<string, any>();
    for (const row of dataDocs.rows) {
      if (isSuccessRow(row)) {
        dataDocMap.set(row.doc._id, row.doc);
      }
    }

    // Transform to CardResourceData format
    const cards: CardResourceData[] = [];
    for (const row of allCardsResult.rows) {
      const cardDoc = row.doc as any;
      const cardId = cardDoc._id;
      const dataDocId = cardToDataMap.get(cardId);
      const dataDoc = dataDocId ? dataDocMap.get(dataDocId) : null;

      cards.push({
        cardId: cardId,
        datashape: dataDoc?.id_datashape || 'unknown',
        data: dataDoc?.data || {},
        tags: [],
        elo: cardDoc.elo?.global?.score || 1500,
        created: cardDoc.created,
        modified: cardDoc.modified
      });
    }

    return {
      cards,
      total: totalCards,
      page: Math.floor(offset / limit) + 1,
      limit,
      filter: 'all'
    };

  } catch (error) {
    console.error('Error fetching all cards:', error);
    throw new Error(`Failed to fetch cards: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle cards://tag/[tagName] resource - Filter cards by tag
 */
export async function handleCardsTagResource(
  courseDB: CourseDBInterface,
  tagName: string,
  limit: number = 50,
  offset: number = 0
): Promise<CardsCollection> {
  try {
    // Get the tag to validate it exists
    const tag = await courseDB.getTag(tagName);
    if (!tag) {
      throw new Error(`Tag not found: ${tagName}`);
    }

    // Note: The current CourseDBInterface doesn't have a direct method to get cards by tag
    // We would need to implement this by querying the tag associations
    // For now, we'll return a placeholder that explains this limitation
    
    return {
      cards: [],
      total: 0,
      page: Math.floor(offset / limit) + 1,
      limit,
      filter: `tag:${tagName}`,
    };

  } catch (error) {
    console.error(`Error fetching cards for tag ${tagName}:`, error);
    throw new Error(`Failed to fetch cards for tag ${tagName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle cards://shape/[shapeName] resource - Filter cards by DataShape
 */
export async function handleCardsShapeResource(
  courseDB: CourseDBInterface,
  shapeName: string,
  limit: number = 50,
  offset: number = 0
): Promise<CardsCollection> {
  try {
    // Validate shape exists in course config
    const courseConfig = await courseDB.getCourseConfig();
    const validShapes = courseConfig.dataShapes.map(ds => ds.name);
    
    if (!validShapes.includes(shapeName)) {
      throw new Error(`DataShape not found: ${shapeName}. Available: ${validShapes.join(', ')}`);
    }

    // Note: Direct filtering by DataShape would require a more sophisticated query
    // For now, we'll get all cards and filter in memory (not optimal for large datasets)
    const allCardIds = await courseDB.getCardsByELO(1500, 1000); // Get more cards to filter from
    
    if (allCardIds.length === 0) {
      return {
        cards: [],
        total: 0,
        page: Math.floor(offset / limit) + 1,
        limit,
        filter: `shape:${shapeName}`
      };
    }

    // Get all card IDs
    const cardIds = allCardIds.map(c => c.cardID);

    // Fetch Card entities to get their data doc references
    const cardDocs = await courseDB.getCourseDocs(cardIds);

    // Extract data document IDs from Card entities
    const dataDocIds: string[] = [];
    const cardToDataMap = new Map<string, string>();

    for (const row of cardDocs.rows) {
      if (isSuccessRow(row)) {
        const cardDoc = row.doc as any;
        const dataIds = cardDoc.id_displayable_data;
        if (dataIds && dataIds.length > 0) {
          const dataDocId = dataIds[0];
          dataDocIds.push(dataDocId);
          cardToDataMap.set(cardDoc._id, dataDocId);
        }
      }
    }

    // Fetch all data documents to check their shapes
    const dataDocs = dataDocIds.length > 0
      ? await courseDB.getCourseDocs(dataDocIds)
      : { rows: [] };

    // Create map: dataDocId -> datashape
    const dataDocShapeMap = new Map<string, string>();
    for (const row of dataDocs.rows) {
      if (isSuccessRow(row)) {
        const dataDoc = row.doc as any;
        dataDocShapeMap.set(dataDoc._id, dataDoc.id_datashape);
      }
    }

    // Filter cards by shape
    const filteredCardIds: string[] = [];
    for (const [cardId, dataDocId] of cardToDataMap.entries()) {
      const dataShape = dataDocShapeMap.get(dataDocId);
      if (dataShape === shapeName) {
        filteredCardIds.push(cardId);
      }
    }

    // Apply pagination to filtered card IDs
    const paginatedCardIds = filteredCardIds.slice(offset, offset + limit);

    // Get ELO data for paginated cards
    const eloData = await courseDB.getCardEloData(paginatedCardIds);
    const eloMap = new Map(eloData.map((elo, index) => [paginatedCardIds[index], elo.global?.score || 1500]));

    // Transform to CardResourceData format
    const cards = await transformCardsToResourceData(courseDB, paginatedCardIds, eloMap);

    // Count total filtered cards
    const totalFiltered = filteredCardIds.length;

    return {
      cards,
      total: totalFiltered,
      page: Math.floor(offset / limit) + 1,
      limit,
      filter: `shape:${shapeName}`
    };

  } catch (error) {
    console.error(`Error fetching cards for shape ${shapeName}:`, error);
    throw new Error(`Failed to fetch cards for shape ${shapeName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle cards://elo/[min]-[max] resource - Filter cards by ELO range
 */
export async function handleCardsEloResource(
  courseDB: CourseDBInterface,
  eloRange: string,
  limit: number = 50,
  offset: number = 0
): Promise<CardsCollection> {
  try {
    // Parse ELO range (format: "1200-1800")
    const [minStr, maxStr] = eloRange.split('-');
    if (!minStr || !maxStr) {
      throw new Error(`Invalid ELO range format: ${eloRange}. Expected format: min-max (e.g., 1200-1800)`);
    }

    const parsedRange = EloRangeSchema.parse({
      min: parseInt(minStr, 10),
      max: parseInt(maxStr, 10)
    });

    // Get cards around the middle of the ELO range
    const targetElo = Math.floor((parsedRange.min + parsedRange.max) / 2);
    const cards = await courseDB.getCardsByELO(targetElo, 1000); // Get more to filter from
    
    if (cards.length === 0) {
      return {
        cards: [],
        total: 0,
        page: Math.floor(offset / limit) + 1,
        limit,
        filter: `elo:${eloRange}`
      };
    }

    // Get ELO data for all cards
    const eloData = await courseDB.getCardEloData(cards.map(c => c.cardID));
    
    // Filter by ELO range
    const filteredEloData = eloData
      .map((elo, index) => ({ elo, cardId: cards[index] }))
      .filter(({ elo }) => {
        const score = elo.global?.score || 1500;
        return score >= parsedRange.min && score <= parsedRange.max;
      });

    // Apply pagination
    const paginatedEloData = filteredEloData.slice(offset, offset + limit);
    const paginatedCards = paginatedEloData.map(({ cardId }) => cardId);

    if (paginatedCards.length === 0) {
      return {
        cards: [],
        total: filteredEloData.length,
        page: Math.floor(offset / limit) + 1,
        limit,
        filter: `elo:${eloRange}`
      };
    }

    // Get card IDs
    const paginatedCardIds = paginatedCards.map(c => c.cardID);
    const eloMap = new Map(paginatedEloData.map(({ elo, cardId }) => [cardId.cardID, elo.global?.score || 1500]));

    // Transform to CardResourceData format
    const cardsData = await transformCardsToResourceData(courseDB, paginatedCardIds, eloMap);

    return {
      cards: cardsData,
      total: filteredEloData.length,
      page: Math.floor(offset / limit) + 1,
      limit,
      filter: `elo:${eloRange}`
    };

  } catch (error) {
    console.error(`Error fetching cards for ELO range ${eloRange}:`, error);
    throw new Error(`Failed to fetch cards for ELO range ${eloRange}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}