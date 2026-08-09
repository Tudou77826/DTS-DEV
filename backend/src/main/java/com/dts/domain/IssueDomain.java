package com.dts.domain;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** 问题领域。 */
@Getter
@Setter
@TableName("cfg_issue_domain")
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IssueDomain extends BaseEntity {

    private String name;

    private String description;

    /** 停用后不再出现在字典下拉中（保留历史引用，用于“重启覆盖”同步）。 */
    private Boolean active;
}
