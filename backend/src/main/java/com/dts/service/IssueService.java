package com.dts.service;

import com.dts.common.BusinessException;
import com.dts.common.PageResult;
import com.dts.domain.*;
import com.dts.dto.IssueDtos;
import com.dts.dto.IssueVo;
import com.dts.repository.*;
import com.dts.security.LoginUser;
import com.dts.security.SecurityUtil;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class IssueService {

    private final IssueRepository issueRepository;
    private final IssueProgressRepository progressRepository;
    private final CommentRepository commentRepository;
    private final OperationLogRepository operationLogRepository;
    private final LookupService lookup;

    // ───────────────────────── 创建/编辑 ─────────────────────────

    @Transactional
    public IssueVo create(IssueDtos.IssueSaveRequest req) {
        LoginUser me = SecurityUtil.current();
        Issue issue = Issue.builder()
                .code(generateCode())
                .raisedAt(LocalDateTime.now())
                .moduleId(req.getModuleId())
                .description(req.getDescription())
                .searchKeywords(req.getSearchKeywords())
                .envInfo(req.getEnvInfo())
                .vpnInfo(req.getVpnInfo())
                .domainId(req.getDomainId())
                .productId(req.getProductId())
                .submitterId(me.getId())
                .submitterNo(req.getSubmitterNo() != null ? req.getSubmitterNo() : me.getEmployeeNo())
                .foundVersionId(req.getFoundVersionId())
                .priority(req.getPriority() == null ? "MEDIUM" : req.getPriority())
                .status(IssueStatus.PENDING_ASSIGN)
                .collaboratorIds("")
                .build();
        issue = issueRepository.save(issue);

        logOperation(issue.getId(), me.getId(), "CREATE", "status", null, IssueStatus.PENDING_ASSIGN, "创建问题");
        return toVo(issue);
    }

    @Transactional
    public IssueVo update(IssueDtos.IssueSaveRequest req) {
        if (req.getId() == null) throw new BusinessException("问题ID不能为空");
        Issue issue = require(req.getId());
        if (req.getModuleId() != null) issue.setModuleId(req.getModuleId());
        if (req.getDescription() != null) issue.setDescription(req.getDescription());
        if (req.getSearchKeywords() != null) issue.setSearchKeywords(req.getSearchKeywords());
        if (req.getEnvInfo() != null) issue.setEnvInfo(req.getEnvInfo());
        if (req.getVpnInfo() != null) issue.setVpnInfo(req.getVpnInfo());
        if (req.getDomainId() != null) issue.setDomainId(req.getDomainId());
        if (req.getProductId() != null) issue.setProductId(req.getProductId());
        if (req.getFoundVersionId() != null) issue.setFoundVersionId(req.getFoundVersionId());
        if (req.getPriority() != null) issue.setPriority(req.getPriority());
        return toVo(issueRepository.save(issue));
    }

    // ───────────────────────── 查询 ─────────────────────────

    @Transactional(readOnly = true)
    public PageResult<IssueVo> page(IssueDtos.IssueQuery q) {
        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt");
        PageRequest pageRequest = PageRequest.of(Math.max(0, q.getPage() - 1), q.getSize(), sort);

        Specification<Issue> spec = (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (q.getKeyword() != null && !q.getKeyword().isBlank()) {
                String kw = "%" + q.getKeyword().trim() + "%";
                ps.add(cb.or(
                        cb.like(root.get("code"), kw),
                        cb.like(root.get("description"), kw),
                        cb.like(root.get("searchKeywords"), kw)));
            }
            if (q.getModuleId() != null) ps.add(cb.equal(root.get("moduleId"), q.getModuleId()));
            if (q.getProductId() != null) ps.add(cb.equal(root.get("productId"), q.getProductId()));
            if (q.getDomainId() != null) ps.add(cb.equal(root.get("domainId"), q.getDomainId()));
            if (q.getStatus() != null && !q.getStatus().isBlank()) ps.add(cb.equal(root.get("status"), q.getStatus()));
            if (q.getSubmitterId() != null) ps.add(cb.equal(root.get("submitterId"), q.getSubmitterId()));
            if (q.getAssigneeId() != null) ps.add(cb.equal(root.get("assigneeId"), q.getAssigneeId()));
            if (q.getFoundVersionId() != null) ps.add(cb.equal(root.get("foundVersionId"), q.getFoundVersionId()));
            if (q.getCreatedFrom() != null) ps.add(cb.greaterThanOrEqualTo(root.get("createdAt"), q.getCreatedFrom()));
            if (q.getCreatedTo() != null) ps.add(cb.lessThanOrEqualTo(root.get("createdAt"), q.getCreatedTo()));
            return cb.and(ps.toArray(new Predicate[0]));
        };

        Page<Issue> page = issueRepository.findAll(spec, pageRequest);
        return PageResult.of(page, toVoList(page.getContent()));
    }

    @Transactional(readOnly = true)
    public Issue get(Long id) {
        return issueRepository.findById(id)
                .orElseThrow(() -> new BusinessException("问题不存在: " + id));
    }

    @Transactional(readOnly = true)
    public IssueVo detail(Long id) {
        return toVo(require(id));
    }

    private Issue require(Long id) {
        return issueRepository.findById(id)
                .orElseThrow(() -> new BusinessException("问题不存在: " + id));
    }

    // ───────────────────────── 分配/转派 ─────────────────────────

    @Transactional
    public IssueVo assign(Long issueId, IssueDtos.AssignRequest req) {
        LoginUser me = SecurityUtil.current();
        Issue issue = require(issueId);

        if (req.getAssigneeId() != null) {
            Long old = issue.getAssigneeId();
            issue.setAssigneeId(req.getAssigneeId());
            logOperation(issueId, me.getId(), "ASSIGNEE", "assigneeId",
                    old == null ? null : String.valueOf(old), String.valueOf(req.getAssigneeId()), "分配责任人");
        }
        if (req.getCollaboratorIds() != null) {
            issue.setCollaboratorIds(joinIds(req.getCollaboratorIds()));
        }
        if (req.getPriority() != null) {
            String old = issue.getPriority();
            issue.setPriority(req.getPriority());
            logOperation(issueId, me.getId(), "PRIORITY", "priority", old, req.getPriority(), "调整优先级");
        }
        if (req.getPlanFinishAt() != null) {
            issue.setPlanFinishAt(req.getPlanFinishAt());
        }
        // 分配时若无定位开始时间，状态切到 待定位
        if (req.getStatus() != null) {
            changeStatus(issue, req.getStatus(), me.getId(), req.getRemark());
        } else if (IssueStatus.PENDING_ASSIGN.equals(issue.getStatus()) && req.getAssigneeId() != null) {
            changeStatus(issue, IssueStatus.PENDING_LOCATE, me.getId(), req.getRemark());
        }
        return toVo(issueRepository.save(issue));
    }

    // ───────────────────────── 状态变更 ─────────────────────────

    @Transactional
    public IssueVo changeStatus(Long issueId, IssueDtos.StatusChangeRequest req) {
        LoginUser me = SecurityUtil.current();
        Issue issue = require(issueId);
        changeStatus(issue, req.getStatus(), me.getId(), req.getRemark());
        return toVo(issueRepository.save(issue));
    }

    private void changeStatus(Issue issue, String newStatus, Long operatorId, String remark) {
        if (!IssueStatus.isValid(newStatus)) {
            throw new BusinessException("非法状态: " + newStatus);
        }
        String old = issue.getStatus();
        if (old.equals(newStatus)) return;

        // 记录定位开始
        if (IssueStatus.LOCATING.equals(newStatus) && issue.getLocatedAt() == null) {
            issue.setLocatedAt(LocalDateTime.now());
        }
        // 记录解决时间
        if (IssueStatus.RESOLVED.equals(newStatus)) {
            issue.setResolvedAt(LocalDateTime.now());
        }
        // 关闭
        if (IssueStatus.CLOSED.equals(newStatus) && issue.getClosedAt() == null) {
            issue.setClosedAt(LocalDateTime.now());
            if (issue.getResolvedAt() == null) issue.setResolvedAt(LocalDateTime.now());
        }
        // 重新打开
        if (IssueStatus.REOPENED.equals(newStatus)) {
            issue.setClosedAt(null);
            issue.setResolvedAt(null);
        }
        issue.setStatus(newStatus);
        logOperation(issue.getId(), operatorId, "STATUS", "status", old, newStatus,
                remark != null ? remark : null);
    }

    // ───────────────────────── 进展记录 ─────────────────────────

    @Transactional
    public IssueProgress addProgress(Long issueId, IssueDtos.ProgressRequest req) {
        LoginUser me = SecurityUtil.current();
        Issue issue = require(issueId);

        IssueProgress p = IssueProgress.builder()
                .issueId(issueId)
                .authorId(me.getId())
                .type(req.getType())
                .content(req.getContent())
                .build();
        p = progressRepository.save(p);

        // 同步汇总字段 + 状态联动
        if (req.isSyncToIssue()) {
            switch (req.getType()) {
                case "PROGRESS" -> issue.setLatestProgress(req.getContent());
                case "ROOT_CAUSE" -> issue.setRootCause(req.getContent());
                case "RESOLUTION" -> issue.setResolution(req.getContent());
                case "WORKAROUND" -> issue.setWorkaround(req.getContent());
                default -> { /* VERIFY 等不更新汇总 */ }
            }
            // 首次记录进展时若在 待定位，则进入 定位中
            if (IssueStatus.PENDING_LOCATE.equals(issue.getStatus())) {
                changeStatus(issue, IssueStatus.LOCATING, me.getId(), "开始定位");
            }
            issueRepository.save(issue);
        }
        logOperation(issueId, me.getId(), "PROGRESS", req.getType(), null, null, req.getContent());
        return p;
    }

    @Transactional(readOnly = true)
    public List<IssueProgress> progressTimeline(Long issueId) {
        return progressRepository.findByIssueIdOrderByCreatedAtAsc(issueId);
    }

    // ───────────────────────── 评论 ─────────────────────────

    @Transactional
    public Comment addComment(Long issueId, IssueDtos.CommentRequest req) {
        LoginUser me = SecurityUtil.current();
        Comment c = Comment.builder()
                .issueId(issueId)
                .authorId(me.getId())
                .content(req.getContent())
                .mentionIds(joinIds(req.getMentionIds()))
                .build();
        return commentRepository.save(c);
    }

    @Transactional(readOnly = true)
    public List<Comment> comments(Long issueId) {
        return commentRepository.findByIssueIdOrderByCreatedAtAsc(issueId);
    }

    // ───────────────────────── 操作日志 ─────────────────────────

    @Transactional(readOnly = true)
    public List<OperationLog> operations(Long issueId) {
        return operationLogRepository.findByIssueIdOrderByCreatedAtAsc(issueId);
    }

    @Transactional
    public void logOperation(Long issueId, Long operatorId, String action, String field,
                             String oldValue, String newValue, String remark) {
        OperationLog log = OperationLog.builder()
                .issueId(issueId)
                .operatorId(operatorId)
                .action(action)
                .field(field)
                .oldValue(oldValue)
                .newValue(newValue)
                .remark(remark)
                .build();
        operationLogRepository.save(log);
    }

    // ───────────────────────── 我的任务 ─────────────────────────

    @Transactional(readOnly = true)
    public java.util.Map<String, Long> mySummary() {
        LoginUser me = SecurityUtil.current();
        java.util.Map<String, Long> m = new HashMap<>();
        m.put("pending", issueRepository.countByAssigneeIdAndStatusIn(me.getId(), IssueStatus.ACTIVE));
        m.put("todayNew", issueRepository.countByAssigneeIdAndCreatedAtAfter(
                me.getId(), LocalDateTime.now().toLocalDate().atStartOfDay()));
        m.put("overdue", (long) issueRepository.findOverdue(LocalDateTime.now()).stream()
                .filter(i -> me.getId().equals(i.getAssigneeId())).count());
        return m;
    }

    @Transactional(readOnly = true)
    public PageResult<IssueVo> myTasks(String tab, int page, int size) {
        LoginUser me = SecurityUtil.current();
        Specification<Issue> spec = (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            ps.add(cb.or(
                    cb.equal(root.get("assigneeId"), me.getId()),
                    cb.like(root.get("collaboratorIds"), "%" + me.getId() + "%")));
            List<String> statuses = switch (tab == null ? "" : tab) {
                case "pending_locate" -> List.of(IssueStatus.PENDING_LOCATE, IssueStatus.PENDING_ASSIGN);
                case "locating" -> List.of(IssueStatus.LOCATING);
                case "need_info" -> List.of(IssueStatus.NEED_INFO);
                case "pending_verify" -> List.of(IssueStatus.PENDING_VERIFY);
                case "overdue" -> List.of();
                case "done" -> IssueStatus.TERMINAL;
                default -> IssueStatus.ACTIVE;
            };
            if ("overdue".equals(tab)) {
                ps.add(root.get("planFinishAt").isNotNull());
                ps.add(cb.lessThan(root.get("planFinishAt"), LocalDateTime.now()));
                ps.add(root.get("status").in(IssueStatus.ACTIVE));
            } else if (!statuses.isEmpty()) {
                ps.add(root.get("status").in(statuses));
            }
            return cb.and(ps.toArray(new Predicate[0]));
        };
        Page<Issue> result = issueRepository.findAll(spec,
                PageRequest.of(Math.max(0, page - 1), size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResult.of(result, toVoList(result.getContent()));
    }

    // ───────────────────────── 工具方法 ─────────────────────────

    private String generateCode() {
        long year = java.time.Year.now().getValue();
        long count = issueRepository.count() + 1;
        return String.format("ISS-%d-%04d", year, count);
    }

    private String joinIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return "";
        return ids.stream().map(String::valueOf).collect(Collectors.joining(","));
    }

    private List<Long> parseIds(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split(","))
                .map(String::trim).filter(s -> !s.isEmpty())
                .map(Long::valueOf).toList();
    }

    // ───────────────────────── VO 组装 ─────────────────────────

    public IssueVo toVo(Issue issue) {
        return toVoList(List.of(issue)).get(0);
    }

    public List<IssueVo> toVoList(List<Issue> issues) {
        if (issues.isEmpty()) return List.of();
        Set<Long> userIds = new HashSet<>();
        Set<Long> moduleIds = new HashSet<>();
        Set<Long> productIds = new HashSet<>();
        Set<Long> versionIds = new HashSet<>();
        Set<Long> domainIds = new HashSet<>();
        for (Issue i : issues) {
            addNullable(userIds, i.getSubmitterId(), i.getAssigneeId());
            addNullable(moduleIds, i.getModuleId());
            addNullable(productIds, i.getProductId());
            addNullable(versionIds, i.getFoundVersionId());
            addNullable(domainIds, i.getDomainId());
            parseIds(i.getCollaboratorIds()).forEach(userIds::add);
        }
        var userMap = lookup.userNames(userIds);
        var moduleMap = lookup.moduleNames(moduleIds);
        var productMap = lookup.productNames(productIds);
        var versionMap = lookup.versionNames(versionIds);

        return issues.stream().map(i -> {
            IssueVo vo = new IssueVo();
            vo.setId(i.getId());
            vo.setCode(i.getCode());
            vo.setRaisedAt(i.getRaisedAt());
            vo.setCreatedAt(i.getCreatedAt());
            vo.setUpdatedAt(i.getUpdatedAt());
            vo.setModuleId(i.getModuleId());
            vo.setModuleName(safeGet(moduleMap, i.getModuleId()));
            vo.setDescription(i.getDescription());
            vo.setSearchKeywords(i.getSearchKeywords());
            vo.setEnvInfo(i.getEnvInfo());
            vo.setVpnInfo(i.getVpnInfo());
            vo.setDomainId(i.getDomainId());
            vo.setDomainName(lookup.domainName(i.getDomainId()));
            vo.setProductId(i.getProductId());
            vo.setProductName(safeGet(productMap, i.getProductId()));
            vo.setSubmitterId(i.getSubmitterId());
            vo.setSubmitterName(safeGet(userMap, i.getSubmitterId()));
            vo.setSubmitterNo(i.getSubmitterNo());
            vo.setFoundVersionId(i.getFoundVersionId());
            vo.setFoundVersionName(safeGet(versionMap, i.getFoundVersionId()));
            vo.setPriority(i.getPriority());
            vo.setStatus(i.getStatus());
            vo.setAssigneeId(i.getAssigneeId());
            vo.setAssigneeName(safeGet(userMap, i.getAssigneeId()));
            List<Long> collabs = parseIds(i.getCollaboratorIds());
            vo.setCollaboratorIds(collabs);
            vo.setCollaboratorNames(collabs.stream().map(id -> safeGet(userMap, id)).toList());
            vo.setLatestProgress(i.getLatestProgress());
            vo.setRootCause(i.getRootCause());
            vo.setResolution(i.getResolution());
            vo.setWorkaround(i.getWorkaround());
            vo.setPlanFinishAt(i.getPlanFinishAt());
            vo.setLocatedAt(i.getLocatedAt());
            vo.setResolvedAt(i.getResolvedAt());
            vo.setClosedAt(i.getClosedAt());
            if (i.getLocatedAt() != null) {
                LocalDateTime end = i.getResolvedAt() != null ? i.getResolvedAt() : LocalDateTime.now();
                vo.setLocateDurationMin(Duration.between(i.getLocatedAt(), end).toMinutes());
            }
            vo.setOverdue(i.getPlanFinishAt() != null
                    && i.getPlanFinishAt().isBefore(LocalDateTime.now())
                    && !IssueStatus.TERMINAL.contains(i.getStatus()));
            return vo;
        }).toList();
    }

    private void addNullable(Set<Long> set, Long... ids) {
        for (Long id : ids) if (id != null) set.add(id);
    }

    /** 不可变 Map（Map.of）不允许 null 键，统一做空值保护。 */
    private String safeGet(Map<Long, String> map, Long key) {
        return key == null ? null : map.get(key);
    }
}
