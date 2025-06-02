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

export interface ThemeConfig {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
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
    colors: {
      primary: '#1976D2',
      secondary: '#424242',
      accent: '#82B1FF'
    }
  },
  medical: {
    name: 'medical',
    colors: {
      primary: '#2E7D32',
      secondary: '#558B2F',
      accent: '#66BB6A'
    }
  },
  educational: {
    name: 'educational',
    colors: {
      primary: '#F57C00',
      secondary: '#FF9800',
      accent: '#FFB74D'
    }
  },
  corporate: {
    name: 'corporate',
    colors: {
      primary: '#37474F',
      secondary: '#546E7A',
      accent: '#78909C'
    }
  }
};