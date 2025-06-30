// // src/mock/store.ts

// import Vue from 'vue';
// import { DataShape } from '@pui/base-course/Interfaces/DataShape';
// import { ViewData } from '@pui/base-course/Interfaces/ViewData';
// import { CourseConfig } from '@pui/server/types';
// import { FieldInputInstance } from '@vue-skuilder/edit-ui';
// import { User } from '@vue-skuilder/db';

// export const GuestUsername: string = 'Guest';

// interface DataInputForm {
//   dataShape: DataShape | null;
//   course: CourseConfig | null;
//   existingData: ViewData[];
//   shapeViews: any[];
//   fields: FieldInputInstance[];
//   localStore: any;
//   uploading: boolean;
// }

// export interface UserConfig {
//   darkMode: boolean;
//   likesConfetti: boolean;
// }

// export interface AppState {
//   _user?: User;
//   userLoginAndRegistrationContainer: {
//     init: boolean;
//     loggedIn: boolean;
//     regDialogOpen: boolean;
//     loginDialogOpen: boolean;
//   };
//   cardPreviewMode: boolean;
//   dataInputForm: DataInputForm;
//   views: {
//     study: {
//       inSession: boolean;
//       courseList: string[];
//       sessionTimeLimit: number;
//     };
//   };
//   config: UserConfig;
//   onLoadComplete: boolean;
// }

// export const defaultState: AppState = {
//   _user: undefined,
//   userLoginAndRegistrationContainer: {
//     init: false,
//     loggedIn: false,
//     regDialogOpen: false,
//     loginDialogOpen: false,
//   },
//   cardPreviewMode: false,
//   dataInputForm: {
//     course: null,
//     dataShape: null,
//     existingData: [],
//     fields: [],
//     localStore: {},
//     shapeViews: [],
//     uploading: false,
//   },
//   views: {
//     study: {
//       inSession: false,
//       courseList: [],
//       sessionTimeLimit: 5,
//     },
//   },
//   config: {
//     darkMode: false,
//     likesConfetti: false,
//   },
//   onLoadComplete: false,
// };

// const Store = new Vuex.Store<AppState>({
//   state: defaultState,
//   mutations: {
//     setUser(state, user: User) {
//       state._user = user;
//     },
//     setLoggedIn(state, loggedIn: boolean) {
//       state.userLoginAndRegistrationContainer.loggedIn = loggedIn;
//     },
//     setConfig(state, config: UserConfig) {
//       state.config = config;
//     },
//     setOnLoadComplete(state, complete: boolean) {
//       state.onLoadComplete = complete;
//     },
//   },
//   actions: {
//     async checkAuth({ commit }) {
//       // Simulate auth check
//       const isLoggedIn = Math.random() > 0.5; // 50% chance of being logged in
//       if (isLoggedIn) {
//         const mockUser = { username: 'MockUser' } as User;
//         commit('setUser', mockUser);
//         commit('setLoggedIn', true);
//         commit('setConfig', { darkMode: false, likesConfetti: true });
//       } else {
//         const guestUser = { username: GuestUsername } as User;
//         commit('setUser', guestUser);
//         commit('setLoggedIn', false);
//       }
//       commit('setOnLoadComplete', true);
//     },
//   },
// });

// export default Store;

// export function setDefaultState() {
//   Store.state.config = defaultState.config;
// }

// // Simulate checking auth on load
// Store.dispatch('checkAuth');
