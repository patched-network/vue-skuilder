import Nano from 'nano';
import type { EnvironmentConfig } from '../types.js';

let CouchDB: Nano.ServerScope;
let couchURLWithProtocol: string;

export function initializeCouchDB(config: EnvironmentConfig): void {
  const { 
    COUCHDB_SERVER: url,
    COUCHDB_PROTOCOL: protocol,
    COUCHDB_ADMIN: username,
    COUCHDB_PASSWORD: password 
  } = config;

  if (!url || !protocol || !username || !password) {
    throw new Error('Missing CouchDB configuration');
  }

  const credentialCouchURL = `${protocol}://${username}:${password}@${url}`;
  CouchDB = Nano(credentialCouchURL);
  couchURLWithProtocol = `${protocol}://${url}`;
}

export function getCouchDB(): Nano.ServerScope {
  if (!CouchDB) {
    throw new Error('CouchDB has not been initialized. Call initializeCouchDB first.');
  }
  return CouchDB;
}

export function getCouchURLWithProtocol(): string {
    if (!couchURLWithProtocol) {
        throw new Error('CouchDB has not been initialized. Call initializeCouchDB first.');
    }
    return couchURLWithProtocol;
}

export async function useOrCreateCourseDB(courseID: string): Promise<Nano.DocumentScope<unknown>> {
  return useOrCreateDB(`coursedb-${courseID}`);
}

interface NanoError extends Error {
  statusCode?: number;
}

export async function useOrCreateDB<T>(dbName: string): Promise<Nano.DocumentScope<T>> {
  const db = getCouchDB().use<T>(dbName);

  try {
    await db.info();
    return db;
  } catch {
    try {
      await getCouchDB().db.create(dbName);
      return db;
      } catch (error: unknown) {
        const createErr = error as NanoError;
        // If error is "database already exists", return existing db
        if (createErr.statusCode === 412) {
        return db;
      }
      throw createErr;
    }
  }
}

export async function docCount(dbName: string): Promise<number> {
  const db = await useOrCreateDB(dbName);
  const info = await db.info();
  return info.doc_count;
}

export interface SecurityObject extends Nano.MaybeDocument {
  admins: {
    names: string[];
    roles: string[];
  };
  members: {
    names: string[];
    roles: string[];
  };
}