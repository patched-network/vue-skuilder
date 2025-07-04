import { ServerRequest, ServerRequestType, PackCourse } from '@vue-skuilder/common';

async function postWithResult<T extends ServerRequest>(request: Omit<T, 'response' | 'user'>): Promise<T['response']> {
    const response = await fetch('http://localhost:3000/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

export async function flushCourse(courseId: string, outputPath?: string) {
    // Get the original course ID for the output path
    // courseId here is the decorated database name, we need the original ID for the path
    const studioConfig = (window as any).STUDIO_CONFIG;
    const originalCourseId = studioConfig?.database?.originalCourseId || courseId;
    
    return await postWithResult<PackCourse>({
        type: ServerRequestType.PACK_COURSE,
        courseId,
        outputPath: outputPath ? outputPath : `./public/static-courses/${originalCourseId}`,
    });
}
