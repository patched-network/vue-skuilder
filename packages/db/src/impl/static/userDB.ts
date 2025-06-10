// packages/db/src/impl/static/userDB.ts

import { UserDBInterface } from '../../core/interfaces';

export class StaticUserDB implements UserDBInterface {
  constructor(_prefix: string) {}

  isLoggedIn(): boolean {
    return false; // Always guest in static mode
  }

  getUsername(): string {
    return 'Guest';
  }

  async createAccount(_username: string, _password: string): Promise<any> {
    throw new Error('Cannot create accounts in static mode');
  }

  async login(_username: string, _password: string): Promise<any> {
    throw new Error('Cannot login in static mode');
  }

  async logout(): Promise<any> {
    return { ok: true };
  }

  async getConfig(): Promise<any> {
    return {}; // Default empty config
  }

  async setConfig(_config: any): Promise<void> {
    // No-op in static mode
  }

  async putCardRecord<T>(_record: T): Promise<any> {
    throw new Error('Cannot record card interactions in static mode');
  }

  async getSeenCards(_courseId?: string): Promise<string[]> {
    return []; // No seen cards in static mode
  }

  async getActiveCards(): Promise<string[]> {
    return []; // No active cards in static mode
  }

  async registerForCourse(_courseId: string, _previewMode?: boolean): Promise<any> {
    return { ok: true, id: 'static-registration', rev: '1-static' };
  }

  async getCourseRegistrationsDoc(): Promise<any> {
    return { courses: [] }; // Empty registrations
  }

  async deregisterFromCourse(_courseId: string): Promise<any> {
    return { ok: true };
  }

  async addScheduledCard(_card: any): Promise<any> {
    throw new Error('Cannot schedule cards in static mode');
  }

  async removeScheduledCard(_qualifiedID: string): Promise<any> {
    throw new Error('Cannot remove scheduled cards in static mode');
  }

  async getScheduledCards(): Promise<any[]> {
    return []; // No scheduled cards in static mode
  }

  async addActivityRecord(_record: any): Promise<any> {
    throw new Error('Cannot add activity records in static mode');
  }

  async getActivityRecords(_courseId?: string): Promise<any[]> {
    return []; // No activity records in static mode
  }

  async setUserElo(_courseId: string, _elo: any): Promise<any> {
    throw new Error('Cannot set user ELO in static mode');
  }

  async getUserElo(_courseId: string): Promise<any> {
    return { global: { score: 1000, count: 0 }, tags: {}, misc: {} };
  }

  async updateDocument(_doc: any): Promise<any> {
    throw new Error('Cannot update documents in static mode');
  }

  async dropCourse(_courseId: string, _dropStatus?: string): Promise<any> {
    return { ok: true };
  }

  async getCourseRegDoc(_courseId: string): Promise<any> {
    return { courseID: _courseId, status: 'active' };
  }

  async getActiveCourses(): Promise<any[]> {
    return []; // No active courses in static mode
  }

  async getPendingReviews(_courseId?: string): Promise<any[]> {
    return []; // No pending reviews in static mode
  }

  async getScheduledReviewCount(_courseId: string): Promise<number> {
    return 0; // No scheduled reviews in static mode
  }

  async getReviewstoDate(_date: any, _courseId?: string): Promise<any[]> {
    return []; // No reviews in static mode
  }

  async addCardToReviews(_card: any): Promise<any> {
    throw new Error('Cannot add cards to reviews in static mode');
  }

  async removeCardFromReviews(_qualifiedID: string): Promise<any> {
    throw new Error('Cannot remove cards from reviews in static mode');
  }

  async scheduleCardReview(_card: any): Promise<any> {
    throw new Error('Cannot schedule card reviews in static mode');
  }

  async removeScheduledCardReview(_qualifiedID: string): Promise<any> {
    throw new Error('Cannot remove scheduled card reviews in static mode');
  }

  async registerForClassroom(_classId: string, _type: string): Promise<any> {
    throw new Error('Cannot register for classrooms in static mode');
  }

  async dropFromClassroom(_classId: string): Promise<any> {
    throw new Error('Cannot drop from classrooms in static mode');
  }

  async getClassroomRegistrations(): Promise<any[]> {
    return []; // No classroom registrations in static mode
  }

  async syncUp(): Promise<any> {
    return { ok: true }; // No sync needed in static mode
  }

  async syncDown(): Promise<any> {
    return { ok: true }; // No sync needed in static mode
  }

  async replicateToRemote(): Promise<any> {
    return { ok: true }; // No replication in static mode
  }

  async replicateFromRemote(): Promise<any> {
    return { ok: true }; // No replication in static mode
  }

  async getUserClassrooms(): Promise<{ registrations: any[] }> {
    return { registrations: [] }; // No classrooms in static mode
  }

  async getActiveClasses(): Promise<any[]> {
    return []; // No active classes in static mode
  }

  async updateUserElo(_courseId: string, _elo: any): Promise<any> {
    throw new Error('Cannot update user ELO in static mode');
  }

  async getCourseInterface(_courseId: string): Promise<any> {
    throw new Error('Cannot get course interface in static mode');
  }

  async update(_doc: any): Promise<any> {
    throw new Error('Cannot update user documents in static mode');
  }
}
