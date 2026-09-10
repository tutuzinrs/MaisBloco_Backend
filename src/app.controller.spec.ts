import { AppController } from './app.controller';
import { AppService } from './app.service';

// NestJS 12 ships ESM-only builds that the CJS Jest runtime on this Node
// version cannot require. Replace `@nestjs/common` with a runtime facade.
jest.mock('@nestjs/common', () => require('./test/mock-nest-common'));

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(() => {
    appService = new AppService();
    appController = new AppController(appService);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});