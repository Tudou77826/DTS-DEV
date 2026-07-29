package com.dts.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dts.domain.Issue;
import com.dts.dto.StatBucket;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;

public interface IssueMapper extends BaseMapper<Issue> {

    /** 各状态问题数量 */
    @Select("SELECT status AS bucket, COUNT(*) AS cnt FROM issue GROUP BY status")
    List<StatBucket> countByStatusGrouped();

    /** 各模块问题数量（bucket 存 moduleId 字符串） */
    @Select("SELECT module_id AS bucket, COUNT(*) AS cnt FROM issue WHERE module_id IS NOT NULL GROUP BY module_id")
    List<StatBucket> countByModuleGrouped();

    /** 各开发人员未完成问题数（bucket 存 assigneeId 字符串） */
    @Select("SELECT assignee_id AS bucket, COUNT(*) AS cnt FROM issue " +
            "WHERE assignee_id IS NOT NULL AND status NOT IN ('RESOLVED','CLOSED') GROUP BY assignee_id")
    List<StatBucket> countPendingByAssignee();

    /** 当天最大编号（用于生成 ISS-yyMMdd-NNN） */
    @Select("SELECT MAX(code) FROM issue WHERE code LIKE #{prefixPattern}")
    String selectMaxCodeByPrefix(@Param("prefixPattern") String prefixPattern);

    /** 超期未关闭问题 */
    @Select("SELECT * FROM issue WHERE plan_finish_at IS NOT NULL " +
            "AND plan_finish_at < #{now} AND status NOT IN ('RESOLVED','CLOSED')")
    List<Issue> findOverdue(@Param("now") LocalDateTime now);
}
