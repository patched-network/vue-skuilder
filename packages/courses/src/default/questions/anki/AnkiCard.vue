<!-- <template>
  <div></div>
</template>

<script lang="ts">
import Vue from 'vue';
import Viewable from '@/base-course/Viewable';

interface AnkiField {
  font: string;
  media: string[]; // type unknown here.
  position: number; // ord
  rtl: boolean;
  size: number; // 20 on examples...?
  sticky: boolean; // false in examples
}

interface AnkiTemplate {
  afmt: string; // answer format? "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}\n\n"
  bafmt: string;
  bqfmt: string;
  // tslint:disable-next-line:max-line-length
  qfmt: string; // question format? "{{Front}}\n\n<br>\n<br>\n\n<div id=\"pips\"></div>\n\n<script>\nvar div = document.getElementById(\"pips\");\nsetTimeout(function(){\n  //div.innerHTML = div.innerHTML + \"*\";\n}, 3000);\n<\/script>"
  did: any; // null in the example. Not sure about this.
  name: string; // human readable name of card type ("Card 1" in example)
  position: number; // ord
}

interface AnkiNoteModel {
  // __type__ : "NoteModel"
  _id: string; // crowdanki_uuid
  css: string; // css
  fields: AnkiField[]; // flds
  latexPost: string; // latexPost: \\end{document}
  latexPre: string; // latexPre: long preamble string...
  name: string; // name: SiteWord-cef25 // combination of human-assigned name and uuid?
  req: any; // req: [ 0, "all", [0] ] // No idea what this refers to
  shortf: number; // shortf: 0
  tags: string[]; // tags: []
  templates: AnkiTemplate[]; // tmpls
  type: number; // type: 0
  vers: any[]; // vers: [] // no idea
}

const template1 = {
  __type__: 'NoteModel',
  crowdanki_uuid: '383671d6-79af-11e8-94bb-40f02f569107',
  // tslint:disable-next-line:max-line-length
  css: '.card {\n font-family: arial;\n font-size: 40px;\n text-align: center;\n color: black;\n background-color: white;\n}\n',
  flds: [
    {
      font: 'Arial',
      media: [],
      name: 'Front',
      ord: 0,
      rtl: false,
      size: 20,
      sticky: false,
    },
    {
      font: 'Arial',
      media: [],
      name: 'Back',
      ord: 1,
      rtl: false,
      size: 20,
      sticky: false,
    },
  ],
  latexPost: '\\end{document}',
  // tslint:disable-next-line:max-line-length
  latexPre:
    '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
  name: 'SiteWord-cef25',
  req: [[0, 'all', [0]]],
  sortf: 0,
  tags: [],
  tmpls: [
    {
      afmt: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}\n\n',
      bafmt: '',
      bqfmt: '',
      did: null,
      name: 'Card 1',
      ord: 0,
      // tslint:disable-next-line:max-line-length
      qfmt: '{{Front}}\n\n<br>\n<br>\n\n<div id="pips"></div>\n\n<script>\nvar div = document.getElementById("pips");\nsetTimeout(function(){\n  //div.innerHTML = div.innerHTML + "*";\n}, 3000)<\/script>',
    },
  ],
  type: 0,
  vers: [],
};

const basicTemplate = {
  __type__: 'NoteModel',
  crowdanki_uuid: '38364ac0-79af-11e8-b58c-40f02f569107',
  // tslint:disable-next-line:max-line-length
  css: '.card {\n font-family: arial;\n font-size: 20px;\n text-align: center;\n color: black;\n background-color: white;\n}',
  flds: [
    {
      font: 'Arial',
      media: [],
      name: 'Front',
      ord: 0,
      rtl: false,
      size: 20,
      sticky: false,
    },
    {
      font: 'Arial',
      media: [],
      name: 'Back',
      ord: 1,
      rtl: false,
      size: 20,
      sticky: false,
    },
  ],
  latexPost: '\\end{document}',
  // tslint:disable-next-line:max-line-length
  latexPre:
    '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
  name: 'Basic-cef25',
  req: [[0, 'all', [0]]],
  sortf: 0,
  tags: [],
  tmpls: [
    {
      afmt: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}',
      bafmt: '',
      bfont: 'Arial',
      bqfmt: '',
      bsize: 12,
      did: null,
      name: 'Card 1',
      ord: 0,
      qfmt: '{{Front}}',
    },
  ],
  type: 0,
  vers: [],
};

const noteData = {
  __type__: 'Note ',
  data: '',
  fields: ['the', '[sound:ankidroid_audiorec-2010477767.3gp]'],
  flags: 0,
  guid: 'PpaY6',
  note_model_uuid: '38364ac0-79af-11e8-b58c-40f02f569107',
  tags: ['marked'],
};

export default class AnkiCard extends Viewable {}
</script> -->
