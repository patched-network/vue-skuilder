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
    return await postWithResult<PackCourse>({
        type: ServerRequestType.PACK_COURSE,
        courseId,
        outputPath,
    });
}
