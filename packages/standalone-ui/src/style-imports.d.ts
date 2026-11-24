// CSS entry points imported for their side effects. Their package exports map
// to .css files, which TS 6 (noUncheckedSideEffectImports) can't resolve as
// modules from the bare specifier.
declare module 'vuetify/styles';
declare module '@vue-skuilder/common-ui/style';
declare module '@vue-skuilder/common-ui/admin/style';
declare module '@vue-skuilder/courseware/style';
