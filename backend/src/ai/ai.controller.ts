import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';

import { AiService, GradeActionPayload } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  async chat(@Body('message') message: string, @GetUser() user: AuthUser) {
    return this.aiService.chat(user.id, message);
  }

  @Post('actions/grade')
  async confirmGradeAction(
    @Body() payload: GradeActionPayload,
    @GetUser() user: AuthUser,
  ) {
    return this.aiService.confirmGradeAction(user.id, payload);
  }

  @Get('history')
  async history(@GetUser() user: AuthUser) {
    return this.aiService.getHistory(user.id);
  }

  @Delete('history')
  async clearHistory(@GetUser() user: AuthUser) {
    return this.aiService.clearHistory(user.id);
  }
}
