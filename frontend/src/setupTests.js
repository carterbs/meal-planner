/* Begin Edit */

import "@testing-library/jest-dom";
import { enableFetchMocks } from "jest-fetch-mock";

// Setup fetch mock
enableFetchMocks();

// jsdom does not implement createObjectURL; mock it for tests that download blobs
if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = jest.fn(() => "blob:mock");
}

/* End Edit */
