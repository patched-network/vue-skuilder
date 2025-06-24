# @vue-skuilder/express Package

Express.js API server providing backend services for the vue-skuilder platform.

## Commands
- Dev: `yarn workspace @vue-skuilder/express dev` (tsx watch mode)
- Build: `yarn workspace @vue-skuilder/express build`
- Start: `yarn workspace @vue-skuilder/express start` (production)
- Test: `yarn workspace @vue-skuilder/express test` (Jest)
- Lint: `yarn workspace @vue-skuilder/express lint:fix`  
- Type check: `yarn workspace @vue-skuilder/express type-check`

## Build System
- **TypeScript**: Compiles to CommonJS in `dist/`
- **Runtime**: Node.js with ES modules (`"type": "module"`)
- **Dev Tool**: `tsx` for hot reloading during development

## Testing
- **Framework**: Jest with TypeScript support
- **Config**: `jest.config.ts` with `ts-jest` preset
- **Environment**: Node.js environment

## Dependencies
### Core
- `express` - Web framework
- `@vue-skuilder/common` - Shared types
- `@vue-skuilder/db` - Database layer

### Middleware & Security
- `cors` - CORS handling
- `express-rate-limit` - Rate limiting
- `cookie-parser` - Cookie parsing
- `morgan` - HTTP logging

### Database & Storage
- `nano` - CouchDB client
- `pouchdb` - Local database support

### Utilities
- `winston` - Structured logging
- `winston-daily-rotate-file` - Log rotation
- `axios` - HTTP client
- `ffmpeg-static` - Media processing
- `hashids` - ID obfuscation

## Key Features
- **CouchDB Integration**: Direct database operations via nano
- **Authentication**: Cookie-based session management
- **File Processing**: Media attachment preprocessing
- **Design Documents**: CouchDB view management
- **Rate Limiting**: API protection
- **Structured Logging**: Winston with file rotation

## Environment Variables
Configure via `.env` file (see `src/utils/env.ts`)