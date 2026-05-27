import { Test, TestingModule } from '@nestjs/testing';
import { AcademicService } from './academic.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AcademicService', () => {
  let service: AcademicService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcademicService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AcademicService>(AcademicService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
