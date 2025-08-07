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
    // Get course info for total count
    const courseInfo = await courseDB.getCourseInfo();
    
    // Get cards using ELO-based query (this gives us all cards sorted by ELO)
    const eloCenteredCards = await courseDB.getCardsByELO(1500, limit + offset);
    
    // Skip offset cards and take limit
    const targetCards = eloCenteredCards.slice(offset, offset + limit);
    
    if (targetCards.length === 0) {
      return {
        cards: [],
        total: courseInfo.cardCount,
        page: Math.floor(offset / limit) + 1,
        limit,
        filter: 'all'
      };
    }

    // Get card documents
    const cardDocs = await courseDB.getCourseDocs(targetCards.map(card => card.cardID));
    
    // Get ELO data for these cards  
    const eloData = await courseDB.getCardEloData(targetCards.map(card => card.cardID));
    const eloMap = new Map(eloData.map((elo, index) => [targetCards[index], elo.global?.score || 1500]));

    // Transform to CardResourceData format
    const cards: CardResourceData[] = [];
    for (const row of cardDocs.rows) {
      if (isSuccessRow(row)) {
        const doc = row.doc;
        cards.push({
          cardId: doc._id,
          datashape: (doc as any).shape?.name || 'unknown',
          data: (doc as any).data || {},
          tags: [], // Will be populated separately if needed
          elo: eloMap.get(doc._id),
          created: (doc as any).created,
          modified: (doc as any).modified
        });
      }
    }

    return {
      cards,
      total: courseInfo.cardCount,
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

    // Get card documents to check their shapes
    const cardDocs = await courseDB.getCourseDocs(allCardIds.map(c => c.cardID));
    
    // Filter by shape and collect card IDs
    const filteredCardIds: string[] = [];
    const allFilteredRows: any[] = [];
    
    for (const row of cardDocs.rows) {
      if (isSuccessRow(row) && (row.doc as any).shape?.name === shapeName) {
        allFilteredRows.push(row);
        filteredCardIds.push(row.doc._id);
      }
    }
    
    // Apply pagination to filtered results
    const paginatedRows = allFilteredRows.slice(offset, offset + limit);
    const paginatedCardIds = paginatedRows.map(row => row.doc._id);

    // Get ELO data for paginated cards
    const eloData = await courseDB.getCardEloData(paginatedCardIds);
    const eloMap = new Map(eloData.map((elo, index) => [paginatedCardIds[index], elo.global?.score || 1500]));

    // Transform to CardResourceData format
    const cards: CardResourceData[] = [];
    for (const row of paginatedRows) {
      if (isSuccessRow(row)) {
        const doc = row.doc;
        cards.push({
          cardId: doc._id,
          datashape: (doc as any).shape?.name || 'unknown',
          data: (doc as any).data || {},
          tags: [],
          elo: eloMap.get(doc._id),
          created: (doc as any).created,
          modified: (doc as any).modified
        });
      }
    }

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

    // Get card documents
    const cardDocs = await courseDB.getCourseDocs(paginatedCards.map(c => c.cardID));
    const eloMap = new Map(paginatedEloData.map(({ elo, cardId }) => [cardId, elo.global?.score || 1500]));

    // Transform to CardResourceData format
    const cardsData: CardResourceData[] = [];
    for (const row of cardDocs.rows) {
      if (isSuccessRow(row)) {
        const doc = row.doc;
        cardsData.push({
          cardId: doc._id,
          datashape: (doc as any).shape?.name || 'unknown',
          data: (doc as any).data || {},
          tags: [],
          elo: eloMap.get(doc._id),
          created: (doc as any).created,
          modified: (doc as any).modified
        });
      }
    }

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