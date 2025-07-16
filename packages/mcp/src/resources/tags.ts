import type { CourseDBInterface } from '@vue-skuilder/db';

export interface TagResource {
  name: string;
  description?: string;
  cardCount: number;
  created?: string;
  author?: string;
  metadata?: any;
}

export interface TagsCollection {
  tags: TagResource[];
  total: number;
  stats?: {
    totalTags: number;
    totalTaggedCards: number;
    averageTagsPerCard: number;
    mostUsedTags: { name: string; count: number }[];
  };
}

export interface TagDistribution {
  tagName: string;
  frequency: number;
  percentage: number;
  cardIds: string[];
}

/**
 * Handle tags://all resource - List all available tags
 */
export async function handleTagsAllResource(
  courseDB: CourseDBInterface
): Promise<TagsCollection> {
  try {
    // Get all tag stubs for the course
    const tagStubsResponse = await courseDB.getCourseTagStubs();
    const tagStubs = tagStubsResponse.rows || [];

    // Transform to TagResource format
    const tags: TagResource[] = [];
    for (const stub of tagStubs) {
      if (stub.doc) {
        // For each tag, we'd need to count associated cards
        // Note: Current CourseDBInterface doesn't have a direct method for this
        // This is a limitation we'll need to address
        tags.push({
          name: (stub.doc as any).name || stub.id,
          description: (stub.doc as any).snippet || `Tag: ${(stub.doc as any).name}`,
          cardCount: (stub.doc as any).taggedCards?.length || 0,
          created: (stub.doc as any).created,
          author: (stub.doc as any).author,
          metadata: (stub.doc as any).metadata
        });
      }
    }

    return {
      tags,
      total: tags.length,
      stats: {
        totalTags: tags.length,
        totalTaggedCards: 0, // Would need additional queries
        averageTagsPerCard: 0, // Would need calculation
        mostUsedTags: [] // Would need tag usage analysis
      }
    };

  } catch (error) {
    console.error('Error fetching all tags:', error);
    throw new Error(`Failed to fetch tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle tags://stats resource - Tag usage statistics
 */
export async function handleTagsStatsResource(
  courseDB: CourseDBInterface
): Promise<TagsCollection['stats']> {
  try {
    // Get all tags
    const tagStubsResponse = await courseDB.getCourseTagStubs();
    const totalTags = tagStubsResponse.rows?.length || 0;

    // Get course info for context  
    const courseInfo = await courseDB.getCourseInfo();
    console.log('Course info loaded for stats:', courseInfo.cardCount);

    // Note: Comprehensive tag statistics would require additional methods
    // in CourseDBInterface to efficiently query tag-card associations
    return {
      totalTags,
      totalTaggedCards: 0, // Placeholder
      averageTagsPerCard: 0, // Placeholder
      mostUsedTags: [] // Placeholder
    };

  } catch (error) {
    console.error('Error fetching tag stats:', error);
    throw new Error(`Failed to fetch tag statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle tags://[tagName] resource - Specific tag details + card count
 */
export async function handleTagSpecificResource(
  courseDB: CourseDBInterface,
  tagName: string
): Promise<TagResource> {
  try {
    // Get the specific tag
    const tag = await courseDB.getTag(tagName);
    if (!tag) {
      throw new Error(`Tag not found: ${tagName}`);
    }

    return {
      name: (tag as any).name || tagName,
      description: (tag as any).snippet || `Tag: ${tagName}`,
      cardCount: (tag as any).taggedCards?.length || 0,
      created: (tag as any).created,
      author: (tag as any).author,
      metadata: (tag as any).metadata
    };

  } catch (error) {
    console.error(`Error fetching tag ${tagName}:`, error);
    throw new Error(`Failed to fetch tag ${tagName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle tags://union/[tag1]+[tag2] resource - Cards with ANY of these tags
 */
export async function handleTagsUnionResource(
  courseDB: CourseDBInterface,
  tagsParam: string
): Promise<{ cardIds: string[]; tags: string[]; operation: 'union' }> {
  try {
    const tags = tagsParam.split('+').map(tag => tag.trim());
    
    if (tags.length === 0) {
      throw new Error('No tags specified for union operation');
    }

    // Validate all tags exist
    for (const tagName of tags) {
      try {
        await courseDB.getTag(tagName);
      } catch {
        throw new Error(`Tag not found: ${tagName}`);
      }
    }

    // Note: Union operation would require specialized queries
    // Current CourseDBInterface doesn't provide tag-based card filtering
    return {
      cardIds: [], // Placeholder
      tags,
      operation: 'union'
    };

  } catch (error) {
    console.error(`Error performing tags union for ${tagsParam}:`, error);
    throw new Error(`Failed to perform tags union: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle tags://intersect/[tag1]+[tag2] resource - Cards with ALL these tags
 */
export async function handleTagsIntersectResource(
  courseDB: CourseDBInterface,
  tagsParam: string
): Promise<{ cardIds: string[]; tags: string[]; operation: 'intersect' }> {
  try {
    const tags = tagsParam.split('+').map(tag => tag.trim());
    
    if (tags.length === 0) {
      throw new Error('No tags specified for intersect operation');
    }

    // Validate all tags exist
    for (const tagName of tags) {
      try {
        await courseDB.getTag(tagName);
      } catch {
        throw new Error(`Tag not found: ${tagName}`);
      }
    }

    // Note: Intersect operation would require specialized queries
    return {
      cardIds: [], // Placeholder
      tags,
      operation: 'intersect'
    };

  } catch (error) {
    console.error(`Error performing tags intersect for ${tagsParam}:`, error);
    throw new Error(`Failed to perform tags intersect: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle tags://exclusive/[tag1]-[tag2] resource - Cards with tag1 but NOT tag2
 */
export async function handleTagsExclusiveResource(
  courseDB: CourseDBInterface,
  tagsParam: string
): Promise<{ cardIds: string[]; includeTag: string; excludeTag: string; operation: 'exclusive' }> {
  try {
    const [includeTag, excludeTag] = tagsParam.split('-').map(tag => tag.trim());
    
    if (!includeTag || !excludeTag) {
      throw new Error('Both include and exclude tags must be specified (format: tag1-tag2)');
    }

    // Validate both tags exist
    try {
      await courseDB.getTag(includeTag);
      await courseDB.getTag(excludeTag);
    } catch (error) {
      throw new Error(`One or both tags not found: ${includeTag}, ${excludeTag}`);
    }

    // Note: Exclusive operation would require specialized queries
    return {
      cardIds: [], // Placeholder
      includeTag,
      excludeTag,
      operation: 'exclusive'
    };

  } catch (error) {
    console.error(`Error performing tags exclusive for ${tagsParam}:`, error);
    throw new Error(`Failed to perform tags exclusive: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle tags://distribution resource - Tag frequency distribution
 */
export async function handleTagsDistributionResource(
  courseDB: CourseDBInterface
): Promise<{ distribution: TagDistribution[]; totalTags: number; totalCards: number }> {
  try {
    // Get all tags
    const tagStubsResponse = await courseDB.getCourseTagStubs();
    const tags = tagStubsResponse.rows || [];
    
    // Get course info
    const courseInfo = await courseDB.getCourseInfo();

    // Note: Full distribution analysis would require additional queries
    // to map tags to cards and calculate frequencies
    const distribution: TagDistribution[] = tags.map(stub => ({
      tagName: stub.doc?.name || stub.id,
      frequency: 0, // Placeholder
      percentage: 0, // Placeholder
      cardIds: [] // Placeholder
    }));

    return {
      distribution,
      totalTags: tags.length,
      totalCards: courseInfo.cardCount
    };

  } catch (error) {
    console.error('Error calculating tag distribution:', error);
    throw new Error(`Failed to calculate tag distribution: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}