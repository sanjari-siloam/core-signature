export interface IContextFeatureFlag {
  userID: string;
  organization_id: number;
  [key: string]: any;
}

export class FeatureFlagService {
  async getStatusFlag(
    _ctx: IContextFeatureFlag,
    _flag: string,
    _defaultValue: boolean = true,
  ): Promise<boolean> {
    console.log(_defaultValue);
    return Promise.reject(new Error('Method not implemented.'));
  }

  async cbStatusFlag(
    _cb: (statusFlag: boolean) => Promise<void> | void,
    _ctx: IContextFeatureFlag,
    _flag: string,
    _defaultValue: boolean = true,
  ): Promise<void> {
    console.log(_defaultValue);
    return Promise.reject(new Error('Method not implemented.'));
  }
}
