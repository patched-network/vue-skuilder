import moment, { Moment } from 'moment';

export interface TestUser {
  username: string;
  password: string;
}

export interface TestCourse {
  courseId: string;
  name: string;
  description: string;
}

export interface TestScheduledReview {
  user: string;
  course_id: string;
  card_id: string;
  time: Moment;
  scheduledFor: 'course' | 'classroom';
  schedulingAgentId: string;
}

export class TestDataFactory {
  private counter = 0;

  createTestUser(usernamePrefix: string = 'testuser'): TestUser {
    this.counter++;
    return {
      username: `${usernamePrefix}${this.counter}_${Date.now()}`,
      password: 'testpassword123',
    };
  }

  createTestCourse(namePrefix: string = 'testcourse'): TestCourse {
    this.counter++;
    const courseId = `${namePrefix}-${this.counter}-${Date.now()}`;
    return {
      courseId,
      name: `Test Course ${this.counter}`,
      description: `Test course description for ${courseId}`,
    };
  }

  createTestScheduledReview(
    user: string,
    courseId: string,
    cardId?: string,
    delayHours: number = 1
  ): TestScheduledReview {
    this.counter++;
    return {
      user,
      course_id: courseId,
      card_id: cardId || `test-card-${this.counter}`,
      time: moment().add(delayHours, 'hours'),
      scheduledFor: 'course',
      schedulingAgentId: `test-agent-${this.counter}`,
    };
  }

  createMultipleTestUsers(count: number, usernamePrefix: string = 'testuser'): TestUser[] {
    return Array.from({ length: count }, () => this.createTestUser(usernamePrefix));
  }

  createTestReviewInPast(
    user: string,
    courseId: string,
    cardId?: string,
    hoursAgo: number = 1
  ): TestScheduledReview {
    this.counter++;
    return {
      user,
      course_id: courseId,
      card_id: cardId || `past-card-${this.counter}`,
      time: moment().subtract(hoursAgo, 'hours'),
      scheduledFor: 'course',
      schedulingAgentId: `past-agent-${this.counter}`,
    };
  }

  reset(): void {
    this.counter = 0;
  }
}
