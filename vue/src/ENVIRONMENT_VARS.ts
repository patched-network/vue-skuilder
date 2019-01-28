interface Environment {
    /**
     * URL to the remote couchDB instance that the app connects to.
     *
     * In development, this can be set as a simple string so that an in-browser
     * pouch-db instance is used instead.
     */
    COUCHDB_SERVER_URL: string;
    /**
     * URL to the Express webserver that serves requests for
     * database creation / reading / writing that are finer-
     * grained than CouchDB's auth system handles automatically
     */
    EXPRESS_SERVER_URL: string;
    /**
     * A global flag to enable debug messaging mode for different libraries
     * in the project.
     */
    DEBUG: boolean;
}

const ENV: Environment = {
    COUCHDB_SERVER_URL: '',
    EXPRESS_SERVER_URL: '',
    DEBUG: false
};

ENV.COUCHDB_SERVER_URL = process.env.VUE_APP_COUCHDB_SERVER!;
ENV.EXPRESS_SERVER_URL = process.env.VUE_APP_EXPRESS_SERVER!;

if (process.env.VUE_APP_DEBUG !== undefined) {
    ENV.DEBUG = process.env.VUE_APP_DEBUG === 'true';
}

export default ENV;
