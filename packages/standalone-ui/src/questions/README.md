# Custom Questions in Standalone UI

This directory contains example implementations of custom question types for the Vue Skuilder platform. These examples demonstrate how to create new `Question` subclasses and their corresponding Vue components, and how to integrate them into your application.

## Example Questions Provided

-   **SimpleTextQuestion**: A basic question that asks for a text input and checks for an exact string match.
-   **MultipleChoiceQuestion**: Presents a question with multiple options and checks for the correct selection.
-   **NumberRangeQuestion**: Asks for a numeric input and validates if it falls within a specified range.

## How to Use These Examples

Each question type consists of two main parts:
1.  A TypeScript file (`.ts`) defining the `Question` subclass, which handles the question logic, data shapes, and answer evaluation.
2.  A Vue component file (`.vue`) that provides the user interface for the question.

These examples are already integrated into the `exampleCourse.ts` file, which you can use to see them in action.

## Integrating Custom Questions into Your Course at Runtime

To use your custom questions in a course, you need to:

1.  **Define your Question Class**: Create a new TypeScript file (e.g., `MyCustomQuestion.ts`) that extends the `Question` class from `@vue-skuilder/courseware`. Define its `dataShapes` and `views` static properties.

    ```typescript
    // MyCustomQuestion.ts
    import { Question, DataShape, ViewData, Answer } from '@vue-skuilder/courseware';
    import { FieldType } from '@vue-skuilder/common';
    import MyCustomQuestionView from './MyCustomQuestionView.vue';

    export class MyCustomQuestion extends Question {
      public static dataShapes: DataShape[] = [
        new DataShape('MyCustomQuestion', [
          { name: 'myField', type: FieldType.STRING },
        ]),
      ];

      public static views = [
        { name: 'MyCustomQuestionView', component: MyCustomQuestionView },
      ];

      constructor(data: ViewData[]) {
        super(data);
        // Initialize your question data from `data`
      }

      public dataShapes(): DataShape[] {
        return MyCustomQuestion.dataShapes;
      }

      public views() {
        return MyCustomQuestion.views;
      }

      protected isCorrect(answer: Answer): boolean {
        // Implement your answer evaluation logic here
        return false;
      }
    }
    ```

2.  **Create Your Vue Component**: Create a Vue component (e.g., `MyCustomQuestionView.vue`) that will render your question and allow user interaction. This component will receive props based on the `ViewData` you define for your question.

    ```vue
    <!-- MyCustomQuestionView.vue -->
    <template>
      <div>
        <p>{{ questionData.myField }}</p>
        <!-- Your input elements and UI -->
        <button @click="submitAnswer">Submit</button>
      </div>
    </template>

    <script setup lang="ts">
    import { ref } from 'vue';
    import { useStudySessionStore } from '@vue-skuilder/common-ui';

    const props = defineProps({
      // Define props based on your question's data
      questionData: { type: Object, required: true },
    });

    const studySessionStore = useStudySessionStore();
    const userAnswer = ref('');

    const submitAnswer = () => {
      // Collect user's answer and submit it
      studySessionStore.submitAnswer({ response: userAnswer.value });
    };
    </script>
    ```

3.  **Register Your Question and Course**: In your application's entry point (e.g., `src/main.ts` or `src/App.vue`), you need to import your custom question and include it in a `Course` instance. Then, register this course with the `allCourses` list.

    ```typescript
    // src/main.ts (example)
    import { createApp } from 'vue';
    import App from './App.vue';
    import { createPinia } from 'pinia';
    import { allCourses, Course } from '@vue-skuilder/courseware';

    // Import your custom question
    import { MyCustomQuestion } from './questions/MyCustomQuestion';

    // Create a new Course instance with your custom question
    const myCustomCourse = new Course('MyCustomCourse', [
      new MyCustomQuestion([{ myField: 'Hello Custom Question!' }]),
    ]);

    // Add your custom course to the global allCourses list
    allCourses.courses.push(myCustomCourse);

    const app = createApp(App);
    app.use(createPinia());
    app.mount('#app');
    ```

    **Note**: The `allCourses` object is a singleton that manages all available courses and their associated questions and views. By adding your custom course to `allCourses.courses`, it becomes discoverable by the `CardViewer` and other components that rely on the course registry.

## Developing New Questions

When developing new questions, consider the following:

-   **DataShape Definition**: Carefully define the `DataShape` for your question. This dictates the structure of the data that will be passed to your question's constructor and Vue component.
-   **Answer Evaluation**: Implement the `isCorrect` method in your `Question` subclass to define how user answers are evaluated.
-   **Vue Component Props**: Ensure your Vue component's `props` match the data fields defined in your `DataShape` and any additional data you pass from your `Question` instance.
-   **StudySessionStore**: Use the `useStudySessionStore()` composable from `@vue-skuilder/common-ui` to submit user answers and interact with the study session logic.

Feel free to modify and extend the provided examples to suit your needs.
