// no imports; mock react-dom/client below

const mockRender = jest.fn();
const mockCreateRoot = jest.fn(() => ({ render: mockRender }));
jest.mock('react-dom/client', () => ({
  __esModule: true,
  default: { createRoot: (...args: any[]) => mockCreateRoot(...args) },
  createRoot: (...args: any[]) => mockCreateRoot(...args),
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

it('creates root and attempts to render App within providers (no throw)', () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  // import after mocks

  require('./index');
  expect(mockCreateRoot).toHaveBeenCalled();
  spy.mockRestore();
});

it('logs error if root element missing', () => {
  document.body.innerHTML = '';
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

  require('./index');
  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
});
