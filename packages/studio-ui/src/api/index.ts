import { ServerRequest, ServerRequestType, PackCourse } from '@vue-skuilder/common';

async function postWithResult<T extends ServerRequest>(request: Omit<T, 'response' | 'user'>): Promise<T['response']> {
    // Get Express API URL from studio configuration
    const studioConfig = (window as any).STUDIO_CONFIG;
    const expressUrl = studioConfig?.express?.url || 'http://localhost:3000/';
    
    console.log('🚀 Sending request to:', expressUrl);
    console.log('📦 Request payload:', JSON.stringify(request, null, 2));
    
    const response = await fetch(expressUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('📥 Response received:', JSON.stringify(result, null, 2));
    return result;
}

export async function flushCourse(courseId: string, outputPath?: string) {
    // Get the original course ID for the output path
    // courseId here is the decorated database name, we need the original ID for the path
    const studioConfig = (window as any).STUDIO_CONFIG;
    console.log('🎯 Studio config:', JSON.stringify(studioConfig, null, 2));
    
    const originalCourseId = studioConfig?.database?.originalCourseId || courseId;
    console.log('📋 Original course ID:', originalCourseId);
    
    // Build CouchDB URL from studio configuration with credentials
    const couchdbConfig = studioConfig?.couchdb;
    const couchdbUrl = couchdbConfig 
        ? `http://${couchdbConfig.username}:${couchdbConfig.password}@${couchdbConfig.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}/coursedb-${courseId}`
        : undefined;
    
    console.log('🗄️ CouchDB config:', couchdbConfig);
    console.log('🔗 Constructed CouchDB URL:', couchdbUrl);
    
    return await postWithResult<PackCourse>({
        type: ServerRequestType.PACK_COURSE,
        courseId,
        outputPath: outputPath ? outputPath : `./public/static-courses/${originalCourseId}`,
        couchdbUrl: couchdbUrl,
    });
}
