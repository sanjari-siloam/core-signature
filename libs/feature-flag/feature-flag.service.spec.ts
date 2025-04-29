import {
  FeatureFlagService,
  IContextFeatureFlag,
} from './feature-flag.service';

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;

  beforeEach(() => {
    jest.restoreAllMocks();
    service = new FeatureFlagService();
    jest.spyOn(console, 'log').mockImplementation();
  });

  describe('getStatusFlag', () => {
    it('should throw the error "Method not implemented.', async () => {
      await expect(
        service.getStatusFlag(
          {} as unknown as IContextFeatureFlag,
          'nameFlag',
          true,
        ),
      ).rejects.toThrow('Method not implemented.');
    });

    it('must call console.log with request parameter', async () => {
      try {
        await service.getStatusFlag(
          {} as unknown as IContextFeatureFlag,
          'nameFlag',
        );
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_err: unknown) {
        // do nothing
      }
      expect(console.log).toHaveBeenCalledWith(true);
    });
  });

  describe('cbStatusFlag', () => {
    it('must return rejected promise with correct error', async () => {
      await expect(
        service.cbStatusFlag(
          () => {},
          {} as unknown as IContextFeatureFlag,
          'nameFlag',
          true,
        ),
      ).rejects.toThrow('Method not implemented.');
    });

    it('must call console.log with request parameter', async () => {
      try {
        await service.cbStatusFlag(
          () => {},
          {} as unknown as IContextFeatureFlag,
          'nameFlag',
        );
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_err: unknown) {
        // do nothing
      }
      expect(console.log).toHaveBeenCalledWith(true);
    });
  });
});
