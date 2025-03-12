import Mousetrap from 'mousetrap';
import 'mousetrap/plugins/global-bind/mousetrap-global-bind.js';
import { ExtendedKeyboardEvent, MousetrapInstance } from 'mousetrap';

export interface HotKey extends HotKeyMetaData {
  callback: (e: ExtendedKeyboardEvent, combo: string) => any;
}

export interface HotKeyMetaData {
  command: string;
  hotkey: string | string[];
}

export class SkldrMouseTrap {
  private static _instance: SkldrMouseTrap;

  private mouseTrap: MousetrapInstance;
  private hotkeys: HotKey[];

  private constructor() {
    this.mouseTrap = new Mousetrap();
    this.hotkeys = [];
  }

  public static get commands(): HotKeyMetaData[] {
    return SkldrMouseTrap.instance().hotkeys.map((hk) => {
      return {
        command: hk.command,
        hotkey: hk.hotkey,
      };
    });
  }

  public static bind(hk: HotKey[]) {
    SkldrMouseTrap.reset();
    SkldrMouseTrap.instance().hotkeys = hk;

    hk.forEach((k) => {
      Mousetrap.bindGlobal(k.hotkey, k.callback);
    });
  }

  public static reset() {
    Mousetrap.reset();
    SkldrMouseTrap.instance().mouseTrap.reset();
    SkldrMouseTrap.instance().hotkeys = [];
  }

  private static instance(): SkldrMouseTrap {
    if (SkldrMouseTrap._instance) {
      return SkldrMouseTrap._instance;
    } else {
      SkldrMouseTrap._instance = new SkldrMouseTrap();
      return SkldrMouseTrap._instance;
    }
  }
}
