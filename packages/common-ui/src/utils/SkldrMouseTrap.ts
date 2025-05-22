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
      Mousetrap.bindGlobal(k.hotkey, (a, b) => {
        console.log(`Running ${k.hotkey}`);
        k.callback(a, b);
      });
    });
  }

  /**
   * Add bindings without resetting existing ones
   */
  public static addBinding(hk: HotKey | HotKey[]) {
    const hotkeys = Array.isArray(hk) ? hk : [hk];
    const instance = SkldrMouseTrap.instance();
    
    // Add to internal registry
    instance.hotkeys = [...instance.hotkeys, ...hotkeys];
    
    // Bind each hotkey
    hotkeys.forEach((k) => {
      Mousetrap.bindGlobal(k.hotkey, (a, b) => {
        console.log(`Running ${k.hotkey}`);
        k.callback(a, b);
      });
    });
  }

  /**
   * Remove a specific binding without affecting others
   */
  public static removeBinding(hotkey: string | string[]) {
    const instance = SkldrMouseTrap.instance();
    const currentHotkeys = [...instance.hotkeys];
    
    // Remove from internal registry
    instance.hotkeys = currentHotkeys.filter(k => {
      // Convert both to JSON for comparison to handle arrays correctly
      return JSON.stringify(k.hotkey) !== JSON.stringify(hotkey);
    });
    
    // Unbind from Mousetrap
    Mousetrap.unbind(hotkey);
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
