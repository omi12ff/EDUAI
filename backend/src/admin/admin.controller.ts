import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';

import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { AdminService } from './admin.service';
import { BanUserDto } from './dto/ban-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  listUsers() {
    return this.adminService.listUsers();
  }

  @Patch('users/:id/role')
  updateRole(
    @GetUser() admin: { id: string; email: string; role: string },
    @Param('id') userId: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateRole(admin.id, userId, dto.role);
  }

  @Patch('users/:id/ban')
  banUser(
    @GetUser() admin: { id: string; email: string; role: string },
    @Param('id') userId: string,
    @Body() dto: BanUserDto,
  ) {
    return this.adminService.banUser(admin.id, userId, dto.reason);
  }

  @Patch('users/:id/unban')
  unbanUser(@Param('id') userId: string) {
    return this.adminService.unbanUser(userId);
  }
}
