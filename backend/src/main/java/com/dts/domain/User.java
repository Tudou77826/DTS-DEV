package com.dts.domain;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 系统用户（问题提出人 / 开发人员 / 项目负责人）。
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

    /** 本地密码（BCrypt 哈希）；统一认证建档用户可为空。仅写入，绝不序列化下发。 */
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;

    private String role; // SUBMITTER / DEVELOPER / LEADER

    private String email;

    private String phone;

    /** 所属团队 ID */
    private Long teamId;

    /** 归属子模块 ID（开发/负责人，用于列表自动筛选） */
    private Long subModuleId;

    /** 头像色（用于前端生成头像底色） */
    private String avatarColor;

    @lombok.Builder.Default
    private Boolean active = true;
}
