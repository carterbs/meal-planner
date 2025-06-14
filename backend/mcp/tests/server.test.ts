import request from 'supertest';
import express from 'express';
import cors from 'cors';

// Create a test app similar to our main server
const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });
  
  return app;
};

describe('MCP Server', () => {
  let app: express.Application;
  
  beforeEach(() => {
    app = createTestApp();
  });
  
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });
  });
  
  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });
  
  describe('JSON Parsing', () => {
    it('should parse JSON requests', async () => {
      // Add a test endpoint for JSON parsing
      app.post('/test-json', (req, res) => {
        res.json({ received: req.body });
      });
      
      const testData = { message: 'Hello, MCP!' };
      const response = await request(app)
        .post('/test-json')
        .send(testData)
        .expect(200);
      
      expect(response.body.received).toEqual(testData);
    });
  });
});