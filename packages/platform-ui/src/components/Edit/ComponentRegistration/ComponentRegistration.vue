<template>
  <div>
    <h3>DataShapes</h3>
    <ul>
      <li v-for="dataShape in dataShapes" :key="dataShape.name" class="ma-2">
        <v-btn v-if="!dataShape.registered" size="small" @click="registerShape(dataShape.name)"> Register </v-btn>
        <span v-else class="inset"> (Registered) </span>
        {{ dataShape.name }}
        <ul>
          <div v-for="view in dataShape.dataShape.views" :key="view.name">
            <li v-if="view">
              {{ view.name }}
            </li>
          </div>
        </ul>
      </li>
    </ul>

    <h3>Questions</h3>
    <ul>
      <li v-for="question in questions" :key="question.name" class="ma-2">
        <v-btn v-if="!question.registered" size="small" @click="registerQuestionView(question.name)"> Register </v-btn>
        <span v-else class="inset"> (Registered) </span>
        {{ question.name }}
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { Displayable } from '@vue-skuilder/common-ui';
import Courses from '@vue-skuilder/courses';
import { getDataLayer, CourseDBInterface } from '@vue-skuilder/db';
import {
  NameSpacer,
  QuestionDescriptor,
  CourseConfig,
  DataShape55,
  QuestionType55,
  DataShape,
} from '@vue-skuilder/common';
import * as _ from 'lodash';
import { getCurrentUser } from '@/stores/useAuthStore';

export interface DataShapeRegistrationStatus {
  name: string;
  course: string;
  dataShape: DataShape;
  registered: boolean;
}

export interface QuestionRegistrationStatus {
  name: string;
  course: string;
  question: typeof Displayable;
  registered: boolean;
}

export default defineComponent({
  name: 'ComponentRegistration',

  props: {
    course: {
      type: String,
      required: true,
    },
  },

  data() {
    return {
      dataShapes: [] as (DataShapeRegistrationStatus & { displayable: typeof Displayable })[],
      questions: [] as QuestionRegistrationStatus[],
      courseDatashapes: [] as DataShape55[],
      courseQuestionTypes: [] as QuestionType55[],
      courseConfig: undefined as CourseConfig | undefined,
      courseDB: null as CourseDBInterface | null,
    };
  },

  async created() {
    this.courseDB = getDataLayer().getCourseDB(this.course);
    this.courseConfig = await this.courseDB.getCourseConfig();
    this.courseDatashapes = this.courseConfig.dataShapes;
    this.courseQuestionTypes = this.courseConfig.questionTypes;

    const dataShapeData = Courses.allDataShapes();

    Courses.allDataShapesRaw().forEach((ds) => {
      console.log(`[ComponentRegistration] Datashape:\n${JSON.stringify(ds)}`);
    });

    dataShapeData.forEach((shape) => {
      const index = this.courseDatashapes.find((test) => {
        return test.name === NameSpacer.getDataShapeString(shape);
      });

      this.dataShapes.push({
        name: shape.dataShape,
        course: shape.course,
        dataShape: Courses.getDataShape(shape),
        registered: index !== undefined,
        displayable: shape.displayable,
      });
    });

    this.dataShapes = _.sortBy(this.dataShapes, ['registered', 'name']);

    const courseNameList = Courses.courses.map((course) => course.name);
    const questionData: Array<[QuestionDescriptor, typeof Displayable]> = [];

    courseNameList.forEach((course) => {
      const courseQs = Courses.getCourse(course)!.questions;

      courseQs.forEach((courseQ) => {
        questionData.push([
          {
            course,
            questionType: courseQ.name,
          },
          courseQ,
        ]);
      });
    });

    questionData.forEach((question) => {
      const index = this.courseQuestionTypes.find((test) => {
        return NameSpacer.getQuestionString(question[0]) === test.name;
      });

      this.questions.push({
        course: question[0].course,
        name: question[1].name,
        registered: index !== undefined,
        question: question[1],
      });
    });
  },

  methods: {
    async registerShape(shapeName: string) {
      const shape = this.dataShapes.find((findShape) => {
        return findShape.name === shapeName;
      })!;

      this.courseConfig!.dataShapes.push({
        name: NameSpacer.getDataShapeString({
          dataShape: shape.name,
          course: shape.course,
        }),
        questionTypes: [],
      });

      const update = await this.courseDB!.updateCourseConfig(this.courseConfig!);

      if (update.ok) {
        shape.registered = true;
      }
    },

    async registerQuestionView(questionName: string) {
      const question = this.questions.find((q) => {
        return q.name === questionName;
      })!;

      const nsQuestionName = NameSpacer.getQuestionString({
        course: question.course,
        questionType: question.name,
      });

      this.courseConfig!.questionTypes.push({
        name: nsQuestionName,
        viewList: question.question.views.map((v) => {
          if (v.name) {
            return v.name;
          } else {
            return 'unnamedComponent';
          }
        }),
        dataShapeList: question.question.dataShapes.map((d) =>
          NameSpacer.getDataShapeString({
            course: question.course,
            dataShape: d.name,
          })
        ),
      });

      question.question.dataShapes.forEach((ds) => {
        const nsDatashapeName = NameSpacer.getDataShapeString({
          course: question.course,
          dataShape: ds.name,
        });

        for (const db of this.courseConfig!.dataShapes) {
          if (db.name === nsDatashapeName) {
            db.questionTypes.push(nsQuestionName);
          }
        }
      });

      const update = await this.courseDB!.updateCourseConfig(this.courseConfig!);
      const u = await getCurrentUser();

      if (update.ok) {
        question.registered = true;
        console.log(`[ComponentRegistration]
Question: ${JSON.stringify(question)}
CourseID: ${this.course}
        `);
        if (question.question.seedData) {
          console.log(`[ComponentRegistration] Question has seed data!`);
          question.question.seedData.forEach((d) => {
            this.courseDB!.addNote(question.course, question.question.dataShapes[0], d, u.getUsername(), []);
          });
        } else {
          console.log(`[ComponentRegistration] Question has NO seed data!`);
        }
      }
    },
  },
});
</script>

<style scoped>
div {
  margin-top: 15px;
}

.inset {
  background-color: rgb(240, 240, 243);
  font-size: smaller;
  padding: 2px;
  border-radius: 2px;
}
</style>
