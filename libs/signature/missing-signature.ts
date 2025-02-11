import { UnauthorizedException } from '@nestjs/common';

export class MissingSignature extends UnauthorizedException {}
