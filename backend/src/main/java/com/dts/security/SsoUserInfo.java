package com.dts.security;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * SSO（统一身份源）返回的标准化用户身份。
 *
 * <p>由 {@link SsoUserService} 把 W3/W3X 的原始响应映射成此结构。
 * 各字段均可为空——身份源至少应提供 {@link #employeeNo} 或 {@link #username} 之一，
 * 否则 {@code SsoAuthenticator} 会拒绝建档。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SsoUserInfo {

    /** 工号（业务侧稳定标识，建档主键）。 */
    private String employeeNo;

    /** 登录名（部分身份源用工号作为登录名）。 */
    private String username;

    /** 姓名/显示名。 */
    private String displayName;

    /** 邮箱（可选）。 */
    private String email;
}
