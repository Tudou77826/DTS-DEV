package com.dts.domain;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 系统用户（问题提出人 / 开发人员 / 项目负责人 / 管理员）。
 */
@Getter
@Setter
@TableName("sys_user")
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User extends BaseEntity {

    /** 工号 */
    private String employeeNo;

    private String username;

    /** 显示名/姓名 */
    private String displayName;

    private String password;

    private String role; // SUBMITTER / DEVELOPER / LEADER / ADMIN

    private String email;

    private String phone;

    /** 所属团队 ID */
    private Long teamId;

    /** 头像色（用于前端生成头像底色） */
    private String avatarColor;

    @lombok.Builder.Default
    private Boolean active = true;
}
