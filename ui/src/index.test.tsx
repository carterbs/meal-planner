// no imports; mock react-dom/client below

const mockRender = jest.fn();
const mockCreateRoot = jest.fn(() => ({ render: mockRender }));
jest.mock('react-dom/client', () => ({
  __esModule: true,
  default: { createRoot: () => mockCreateRoot() },
  createRoot: () => mockCreateRoot(),
}));

// Ensure a root element exists
beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
});

afterEach(() => {
  document.body.innerHTML = '';
  jest.resetModules();
  jest.clearAllMocks();
});

it('creates root and attempts to render App within providers (no throw)', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => { });
  // import after mocks
  await import('./index');
  expect(mockCreateRoot).toHaveBeenCalled();
  spy.mockRestore();
});

it('logs error if root element missing', async () => {
  document.body.innerHTML = '';
  const spy = jest.spyOn(console, 'error').mockImplementation(() => { });
  await import('./index');
  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
});

export { };
