export interface CliOptions {
  dataLayer: 'static' | 'dynamic';
  theme: 'default' | 'medical' | 'educational' | 'corporate';
  interactive: boolean;
  couchdbUrl?: string;
  courseId?: string;
}

export interface ProjectConfig {
  projectName: string;
  title: string;
  dataLayerType: 'static' | 'couch';
  course?: string;
  couchdbUrl?: string;
  theme: ThemeConfig;
}

export interface VuetifyThemeDefinition {
  dark: boolean;
  colors: {
    // Core semantic colors
    primary: string;
    secondary: string;
    accent: string;
    error: string;
    info: string;
    success: string;
    warning: string;
    
    // Surface colors
    background: string;
    surface: string;
    'surface-bright': string;
    'surface-light': string;
    'surface-variant': string;
    'on-surface-variant': string;
    
    // Derived colors
    'primary-darken-1': string;
    'secondary-darken-1': string;
    
    // Text colors
    'on-primary': string;
    'on-secondary': string;
    'on-background': string;
    'on-surface': string;
  };
}

export interface ThemeConfig {
  name: string;
  light: VuetifyThemeDefinition;
  dark: VuetifyThemeDefinition;
  defaultMode: 'light' | 'dark';
}

export interface SkuilderConfig {
  title: string;
  course?: string;
  dataLayerType: 'static' | 'couch';
  couchdbUrl?: string;
  theme?: ThemeConfig;
}

export interface InitCommandOptions extends CliOptions {
  projectName: string;
}

export const PREDEFINED_THEMES: Record<string, ThemeConfig> = {
  default: {
    name: 'default',
    defaultMode: 'light',
    light: {
      dark: false,
      colors: {
        primary: '#1976D2',
        secondary: '#424242',
        accent: '#82B1FF',
        error: '#F44336',
        info: '#2196F3',
        success: '#4CAF50',
        warning: '#FF9800',
        background: '#FFFFFF',
        surface: '#FFFFFF',
        'surface-bright': '#FFFFFF',
        'surface-light': '#EEEEEE',
        'surface-variant': '#E3F2FD',
        'on-surface-variant': '#1976D2',
        'primary-darken-1': '#1565C0',
        'secondary-darken-1': '#212121',
        'on-primary': '#FFFFFF',
        'on-secondary': '#FFFFFF',
        'on-background': '#212121',
        'on-surface': '#212121',
      }
    },
    dark: {
      dark: true,
      colors: {
        primary: '#2196F3',
        secondary: '#90A4AE',
        accent: '#82B1FF',
        error: '#FF5252',
        info: '#2196F3',
        success: '#4CAF50',
        warning: '#FFC107',
        background: '#121212',
        surface: '#1E1E1E',
        'surface-bright': '#2C2C2C',
        'surface-light': '#2C2C2C',
        'surface-variant': '#1A237E',
        'on-surface-variant': '#82B1FF',
        'primary-darken-1': '#1976D2',
        'secondary-darken-1': '#546E7A',
        'on-primary': '#000000',
        'on-secondary': '#000000',
        'on-background': '#FFFFFF',
        'on-surface': '#FFFFFF',
      }
    }
  },
  medical: {
    name: 'medical',
    defaultMode: 'light',
    light: {
      dark: false,
      colors: {
        primary: '#2E7D32',
        secondary: '#558B2F',
        accent: '#66BB6A',
        error: '#D32F2F',
        info: '#1976D2',
        success: '#388E3C',
        warning: '#F57C00',
        background: '#FAFAFA',
        surface: '#FFFFFF',
        'surface-bright': '#FFFFFF',
        'surface-light': '#F5F5F5',
        'surface-variant': '#E8F5E8',
        'on-surface-variant': '#2E7D32',
        'primary-darken-1': '#1B5E20',
        'secondary-darken-1': '#33691E',
        'on-primary': '#FFFFFF',
        'on-secondary': '#FFFFFF',
        'on-background': '#212121',
        'on-surface': '#212121',
      }
    },
    dark: {
      dark: true,
      colors: {
        primary: '#4CAF50',
        secondary: '#8BC34A',
        accent: '#81C784',
        error: '#F44336',
        info: '#2196F3',
        success: '#4CAF50',
        warning: '#FF9800',
        background: '#121212',
        surface: '#1E1E1E',
        'surface-bright': '#2C2C2C',
        'surface-light': '#2C2C2C',
        'surface-variant': '#1B2E1B',
        'on-surface-variant': '#81C784',
        'primary-darken-1': '#388E3C',
        'secondary-darken-1': '#689F38',
        'on-primary': '#000000',
        'on-secondary': '#000000',
        'on-background': '#FFFFFF',
        'on-surface': '#FFFFFF',
      }
    }
  },
  educational: {
    name: 'educational',
    defaultMode: 'light',
    light: {
      dark: false,
      colors: {
        primary: '#F57C00',
        secondary: '#FF9800',
        accent: '#FFB74D',
        error: '#F44336',
        info: '#2196F3',
        success: '#4CAF50',
        warning: '#FF9800',
        background: '#FFFEF7',
        surface: '#FFFFFF',
        'surface-bright': '#FFFFFF',
        'surface-light': '#FFF8E1',
        'surface-variant': '#FFF3E0',
        'on-surface-variant': '#F57C00',
        'primary-darken-1': '#E65100',
        'secondary-darken-1': '#F57C00',
        'on-primary': '#FFFFFF',
        'on-secondary': '#000000',
        'on-background': '#212121',
        'on-surface': '#212121',
      }
    },
    dark: {
      dark: true,
      colors: {
        primary: '#FF9800',
        secondary: '#FFB74D',
        accent: '#FFCC02',
        error: '#FF5252',
        info: '#2196F3',
        success: '#4CAF50',
        warning: '#FF9800',
        background: '#121212',
        surface: '#1E1E1E',
        'surface-bright': '#2C2C2C',
        'surface-light': '#2C2C2C',
        'surface-variant': '#2E1A00',
        'on-surface-variant': '#FFCC02',
        'primary-darken-1': '#F57C00',
        'secondary-darken-1': '#FF9800',
        'on-primary': '#000000',
        'on-secondary': '#000000',
        'on-background': '#FFFFFF',
        'on-surface': '#FFFFFF',
      }
    }
  },
  corporate: {
    name: 'corporate',
    defaultMode: 'light',
    light: {
      dark: false,
      colors: {
        primary: '#37474F',
        secondary: '#546E7A',
        accent: '#78909C',
        error: '#F44336',
        info: '#2196F3',
        success: '#4CAF50',
        warning: '#FF9800',
        background: '#FAFAFA',
        surface: '#FFFFFF',
        'surface-bright': '#FFFFFF',
        'surface-light': '#F5F5F5',
        'surface-variant': '#ECEFF1',
        'on-surface-variant': '#37474F',
        'primary-darken-1': '#263238',
        'secondary-darken-1': '#455A64',
        'on-primary': '#FFFFFF',
        'on-secondary': '#FFFFFF',
        'on-background': '#212121',
        'on-surface': '#212121',
      }
    },
    dark: {
      dark: true,
      colors: {
        primary: '#607D8B',
        secondary: '#78909C',
        accent: '#90A4AE',
        error: '#FF5252',
        info: '#2196F3',
        success: '#4CAF50',
        warning: '#FFC107',
        background: '#121212',
        surface: '#1E1E1E',
        'surface-bright': '#2C2C2C',
        'surface-light': '#2C2C2C',
        'surface-variant': '#1C2429',
        'on-surface-variant': '#90A4AE',
        'primary-darken-1': '#455A64',
        'secondary-darken-1': '#546E7A',
        'on-primary': '#FFFFFF',
        'on-secondary': '#FFFFFF',
        'on-background': '#FFFFFF',
        'on-surface': '#FFFFFF',
      }
    }
  }
};