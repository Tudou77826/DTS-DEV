package com.dts.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
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
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "sys_user")
public class User extends BaseEntity {

    /** 工号 */
    @Column(nullable = false, unique = true, length = 32)
    private String employeeNo;

    @Column(nullable = false, unique = true, length = 64)
    private String username;

    /** 显示名/姓名 */
    @Column(nullable = false, length = 64)
    private String displayName;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false, length = 32)
    private String role; // SUBMITTER / DEVELOPER / LEADER / ADMIN

    @Column(length = 64)
    private String email;

    @Column(length = 32)
    private String phone;

    /** 所属团队 ID */
    @Column(name = "team_id")
    private Long teamId;

    /** 头像色（用于前端生成头像底色） */
    @Column(name = "avatar_color", length = 16)
    private String avatarColor;

    @lombok.Builder.Default
    @Column(nullable = false)
    private Boolean active = true;
}
