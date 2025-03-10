import { Status } from '@vue-skuilder/common';
import { ENV } from '@vue-skuilder/common';
import { ServerRequest } from '@vue-skuilder/common';

const SERVER = ENV.EXPRESS_SERVER_PROTOCOL + '://' + ENV.EXPRESS_SERVER_URL;

/**
* Makes an authenticated request to the express backend and returns the response.

* @param requestData
* @returns
*/
export default async function serverRequest<T extends ServerRequest>(requestData: T): Promise<T> {
  return new Promise<T>((resolve) => {
    try {
      const xml = new XMLHttpRequest();
      xml.withCredentials = true;
      xml.open('POST', SERVER, true);
      xml.setRequestHeader('Content-Type', 'application/json');
      xml.timeout = requestData.timeout || 7000;

      // Handle the response when it completes
      xml.onload = function () {
        try {
          requestData.response = JSON.parse(xml.responseText);
          resolve(requestData);
        } catch (parseError) {
          requestData.response = {
            status: Status.error,
            ok: false,
            errorText: `Failed to parse response: ${
              parseError instanceof Error ? parseError.message : JSON.stringify(parseError)
            }`,
          };
          resolve(requestData);
        }
      };

      // Handle network errors
      xml.onerror = function () {
        requestData.response = {
          status: Status.error,
          ok: false,
          errorText: 'Network error occurred',
        };
        resolve(requestData);
      };

      // Handle timeouts
      xml.ontimeout = function () {
        requestData.response = {
          status: Status.error,
          ok: false,
          errorText: 'Request timed out',
        };
        resolve(requestData);
      };

      // Send the request
      xml.send(JSON.stringify(requestData));
    } catch (error) {
      // Handle any errors that occur during setup
      requestData.response = {
        status: Status.error,
        ok: false,
        errorText: error instanceof Error ? error.message : JSON.stringify(error),
      };
      resolve(requestData);
    }
  });
}
