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

  /**
   * Add keyboard bindings without resetting existing ones
   * @param hk Single hotkey or array of hotkeys to bind
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
   * Remove specific keyboard binding(s) without affecting others
   * @param hotkey Single hotkey or array of hotkeys to remove
   */
  public static removeBinding(hotkey: string | string[] | Array<string | string[]>) {
    const instance = SkldrMouseTrap.instance();
    const currentHotkeys = [...instance.hotkeys];
    
    if (Array.isArray(hotkey) && !hotkey.every(k => typeof k === 'string' || typeof k === 'number')) {
      // If it's an array of hotkey specifiers
      hotkey.forEach(key => {
        // Remove from internal registry
        instance.hotkeys = instance.hotkeys.filter(k => {
          return JSON.stringify(k.hotkey) !== JSON.stringify(key);
        });
        
        // Unbind from Mousetrap
        Mousetrap.unbind(key);
      });
    } else {
      // Single hotkey removal (original implementation)
      // Remove from internal registry
      instance.hotkeys = currentHotkeys.filter(k => {
        // Convert both to JSON for comparison to handle arrays correctly
        return JSON.stringify(k.hotkey) !== JSON.stringify(hotkey);
      });
      
      // Unbind from Mousetrap
      Mousetrap.unbind(hotkey);
    }
  }

  /**
   * Reset all keyboard bindings
   * @warning Consider using removeBinding() for targeted cleanup instead to avoid affecting other components
   */
  public static reset() {
    console.warn(
      'SkldrMouseTrap.reset() may affect hotkeys registered by other components. ' +
      'Consider using removeBinding() with specific hotkeys for better component isolation.'
    );
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
