package com.dts.service;

import com.dts.common.BusinessException;
import com.dts.config.DtsCustomizationProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.DumperOptions;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.LinkedHashMap;

/** 管理员维护外部接入配置文件的安全入口。 */
@Service
@RequiredArgsConstructor
public class CustomizationAdminService {

    private static final String CLASSPATH_FILE = "dts-customization.yml";
    private static final Set<String> KEBAB_CASE_PROPERTIES = Set.of(
            "targetTeam", "targetSystem", "productName", "shortName", "loginTitle",
            "loginSubtitle", "primaryColor", "showDemoAccounts", "demoAccountHint", "defaultPriority",
            "datePattern", "sequenceDigits", "masterData", "syncMode",
            "employeeNo", "displayName", "avatarColor", "passwordHash",
            "batchOperations", "excelExport", "richText");

    @Value("${app.customization.external-file:./config/dts-customization.yml}")
    private String externalFile;

    private final ObjectMapper objectMapper;

    public ConfigFileView read() {
        Path external = externalPath();
        try {
            boolean exists = Files.isRegularFile(external);
            String content = exists
                    ? Files.readString(external, StandardCharsets.UTF_8)
                    : new ClassPathResource(CLASSPATH_FILE).getContentAsString(StandardCharsets.UTF_8);
            ConfigFileView view = new ConfigFileView();
            view.setContent(content);
            view.setSource(exists ? "EXTERNAL" : "CLASSPATH_DEFAULT");
            view.setExternalPath(external.toString());
            view.setRestartRequired(false);
            if (exists) view.setLastModified(Files.getLastModifiedTime(external).toInstant().toString());
            return view;
        } catch (IOException e) {
            throw new BusinessException("读取接入配置失败: " + e.getMessage());
        }
    }

    public ValidationResult validate(String content) {
        List<String> errors = validateContent(content);
        ValidationResult result = new ValidationResult();
        result.setValid(errors.isEmpty());
        result.setErrors(errors);
        return result;
    }

    public StructuredConfigView readStructured() {
        ConfigFileView file = read();
        StructuredConfigView view = new StructuredConfigView();
        view.setCustomization(parseStructured(file.getContent()));
        view.setSource(file.getSource());
        view.setExternalPath(file.getExternalPath());
        view.setLastModified(file.getLastModified());
        return view;
    }

    public ConfigFileView saveStructured(DtsCustomizationProperties customization) {
        if (customization == null) throw new BusinessException("接入配置不能为空");
        Map<String, Object> customizationMap = objectMapper.convertValue(customization, LinkedHashMap.class);
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("dts", Map.of("customization", toKebabKeys(customizationMap)));
        DumperOptions options = new DumperOptions();
        options.setDefaultFlowStyle(DumperOptions.FlowStyle.BLOCK);
        options.setPrettyFlow(true);
        options.setIndent(2);
        options.setIndicatorIndent(0);
        options.setDefaultScalarStyle(DumperOptions.ScalarStyle.PLAIN);
        return save(new Yaml(options).dump(root));
    }

    public ConfigFileView save(String content) {
        List<String> errors = validateContent(content);
        if (!errors.isEmpty()) throw new BusinessException("配置校验失败: " + String.join("；", errors));

        Path target = externalPath();
        try {
            Files.createDirectories(target.getParent());
            if (Files.isRegularFile(target)) {
                String suffix = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
                Files.copy(target, target.resolveSibling(target.getFileName() + ".bak-" + suffix),
                        StandardCopyOption.COPY_ATTRIBUTES);
            }
            Path temp = Files.createTempFile(target.getParent(), "dts-customization-", ".tmp");
            Files.writeString(temp, normalizeLineEndings(content), StandardCharsets.UTF_8);
            try {
                Files.move(temp, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException e) {
                Files.move(temp, target, StandardCopyOption.REPLACE_EXISTING);
            }
            ConfigFileView view = read();
            view.setRestartRequired(true);
            return view;
        } catch (IOException e) {
            throw new BusinessException("保存接入配置失败: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private List<String> validateContent(String content) {
        if (content == null || content.isBlank()) return List.of("配置内容不能为空");
        try {
            Object loaded = new Yaml().load(content);
            if (!(loaded instanceof Map<?, ?> root)) return List.of("YAML 根节点必须是对象");
            Object dtsValue = root.get("dts");
            if (!(dtsValue instanceof Map<?, ?> dts)) return List.of("缺少 dts 节点");
            Object customizationValue = dts.get("customization");
            if (!(customizationValue instanceof Map<?, ?> customization)) {
                return List.of("缺少 dts.customization 节点");
            }
            java.util.ArrayList<String> errors = new java.util.ArrayList<>();
            requireMap(customization, "profile", errors);
            requireMap(customization, "branding", errors);
            Map<?, ?> issue = requireMap(customization, "issue", errors);
            Map<?, ?> masterData = requireMap(customization, "master-data", errors);
            validateAdmin(customization.get("admin"), errors);
            if (issue != null) validateIssue(issue, errors);
            if (masterData != null) validateMasterData(masterData, customization.get("roles"), errors);
            return errors;
        } catch (Exception e) {
            return List.of("YAML 语法错误: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private DtsCustomizationProperties parseStructured(String content) {
        try {
            Object loaded = new Yaml().load(content);
            Map<String, Object> root = (Map<String, Object>) loaded;
            Map<String, Object> dts = (Map<String, Object>) root.get("dts");
            Map<String, Object> customization = (Map<String, Object>) dts.get("customization");
            return objectMapper.convertValue(toCamelKeys(customization), DtsCustomizationProperties.class);
        } catch (Exception e) {
            throw new BusinessException("解析接入配置失败: " + e.getMessage());
        }
    }

    private Object toCamelKeys(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> converted = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                converted.put(toCamelCase(String.valueOf(entry.getKey())), toCamelKeys(entry.getValue()));
            }
            return converted;
        }
        if (value instanceof List<?> list) return list.stream().map(this::toCamelKeys).toList();
        return value;
    }

    private Object toKebabKeys(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> converted = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                converted.put(toKebabCase(String.valueOf(entry.getKey())), toKebabKeys(entry.getValue()));
            }
            return converted;
        }
        if (value instanceof List<?> list) return list.stream().map(this::toKebabKeys).toList();
        return value;
    }

    private String toCamelCase(String value) {
        StringBuilder result = new StringBuilder();
        boolean upper = false;
        for (char ch : value.toCharArray()) {
            if (ch == '-') {
                upper = true;
            } else {
                result.append(upper ? Character.toUpperCase(ch) : ch);
                upper = false;
            }
        }
        return result.toString();
    }

    private String toKebabCase(String value) {
        if (!KEBAB_CASE_PROPERTIES.contains(value)) return value;
        return value.replaceAll("([a-z0-9])([A-Z])", "$1-$2").toLowerCase(java.util.Locale.ROOT);
    }

    private void validateIssue(Map<?, ?> issue, List<String> errors) {
        Map<?, ?> code = requireMap(issue, "code", errors);
        if (code != null) {
            String prefix = stringValue(code.get("prefix"));
            if (prefix == null || !prefix.matches("[A-Za-z0-9_-]{1,20}")) {
                errors.add("issue.code.prefix 仅允许 1-20 位字母、数字、下划线或短横线");
            }
            int digits = intValue(code.get("sequence-digits"), -1);
            if (digits < 1 || digits > 9) errors.add("issue.code.sequence-digits 必须为 1-9");
        }
        Set<String> priorities = optionValues(issue.get("priorities"), "issue.priorities", errors);
        String defaultPriority = stringValue(issue.get("default-priority"));
        if (defaultPriority == null || !priorities.contains(defaultPriority)) {
            errors.add("issue.default-priority 必须存在于 priorities 中");
        }
        Set<String> statuses = optionValues(issue.get("statuses"), "issue.statuses", errors);
        Object transitionsValue = issue.get("transitions");
        if (!(transitionsValue instanceof Map<?, ?> transitions)) {
            errors.add("issue.transitions 必须是流转映射");
        } else {
            for (Map.Entry<?, ?> entry : transitions.entrySet()) {
                String from = stringValue(entry.getKey());
                if (!statuses.contains(from)) errors.add("transitions 包含未知来源状态: " + from);
                if (!(entry.getValue() instanceof List<?> targets)) {
                    errors.add("状态 " + from + " 的流转目标必须是数组");
                    continue;
                }
                for (Object target : targets) {
                    String to = stringValue(target);
                    if (!statuses.contains(to)) errors.add("transitions 包含未知目标状态: " + to);
                }
            }
        }
    }

    private Set<String> optionValues(Object value, String path, List<String> errors) {
        Set<String> values = new HashSet<>();
        if (!(value instanceof List<?> options) || options.isEmpty()) {
            errors.add(path + " 至少需要一项");
            return values;
        }
        for (Object option : options) {
            if (!(option instanceof Map<?, ?> map)) {
                errors.add(path + " 的每一项必须是对象");
                continue;
            }
            String code = stringValue(map.get("value"));
            String label = stringValue(map.get("label"));
            if (code == null || label == null) errors.add(path + " 的 value 和 label 不能为空");
            else if (!values.add(code)) errors.add(path + " 存在重复 value: " + code);
        }
        return values;
    }

    private void validateMasterData(Map<?, ?> masterData, Object rolesValue, List<String> errors) {        Set<String> roleValues = optionValues(rolesValue, "roles", errors);
        Set<String> teamKeys = new HashSet<>();
        Object teamsValue = masterData.get("teams");
        if (!(teamsValue instanceof List<?> teams) || teams.isEmpty()) {
            errors.add("master-data.teams 至少需要一个团队");
        } else {
            for (Object item : teams) {
                if (!(item instanceof Map<?, ?> team)) {
                    errors.add("master-data.teams 的每一项必须是对象");
                    continue;
                }
                String key = stringValue(team.get("key"));
                String name = stringValue(team.get("name"));
                if (key == null || name == null) errors.add("团队 key 和 name 不能为空");
                else if (!teamKeys.add(key)) errors.add("团队 key 重复: " + key);
            }
        }

        Set<String> usernames = new HashSet<>();
        Set<String> employeeNos = new HashSet<>();
        boolean hasLeader = false;
        boolean hasDeveloper = false;
        Object usersValue = masterData.get("users");
        if (!(usersValue instanceof List<?> users) || users.isEmpty()) {
            errors.add("master-data.users 至少需要一个用户");
            return;
        }
        for (Object item : users) {
            if (!(item instanceof Map<?, ?> user)) {
                errors.add("master-data.users 的每一项必须是对象");
                continue;
            }
            String username = stringValue(user.get("username"));
            String employeeNo = stringValue(user.get("employee-no"));
            String displayName = stringValue(user.get("display-name"));
            String role = stringValue(user.get("role"));
            String team = stringValue(user.get("team"));
            if (username == null || employeeNo == null || displayName == null || role == null) {
                errors.add("用户 username、employee-no、display-name 和 role 不能为空");
                continue;
            }
            if (!usernames.add(username)) errors.add("用户名重复: " + username);
            if (!employeeNos.add(employeeNo)) errors.add("工号重复: " + employeeNo);
            if (!roleValues.contains(role)) errors.add("用户 " + username + " 使用了未知角色: " + role);
            if (team != null && !teamKeys.contains(team)) errors.add("用户 " + username + " 引用了未知团队: " + team);
            boolean active = !Boolean.FALSE.equals(user.get("active"));
            if (active && "LEADER".equals(role)) hasLeader = true;
            if (active && "DEVELOPER".equals(role)) hasDeveloper = true;
        }
        if (!hasLeader) errors.add("至少需要一个启用的 LEADER 用户作为项目负责人");
        if (!hasDeveloper) errors.add("至少需要一个启用的 DEVELOPER 用户作为责任人");
    }

    private void validateAdmin(Object adminValue, List<String> errors) {
        if (!(adminValue instanceof Map<?, ?> admin)) {
            errors.add("缺少 admin 节点，请配置管理员共享密码（admin.password-hash）");
            return;
        }
        String passwordHash = stringValue(admin.get("password-hash"));
        if (passwordHash == null) {
            errors.add("admin.password-hash 不能为空，请配置管理员共享密码");
        } else if (!passwordHash.startsWith("$2")) {
            errors.add("admin.password-hash 必须是 BCrypt 哈希（$2a/$2b/$2y 开头）");
        }
    }

    private Map<?, ?> requireMap(Map<?, ?> parent, String key, List<String> errors) {
        Object value = parent.get(key);
        if (value instanceof Map<?, ?> map) return map;
        errors.add("缺少或无效节点: " + key);
        return null;
    }

    private Path externalPath() {
        Path path = Path.of(externalFile).toAbsolutePath().normalize();
        if (path.getParent() == null) throw new BusinessException("外部配置路径无效");
        return path;
    }

    private String normalizeLineEndings(String content) {
        return content.replace("\r\n", "\n").replace('\r', '\n').stripTrailing() + "\n";
    }

    private String stringValue(Object value) {
        if (value == null) return null;
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private int intValue(Object value, int fallback) {
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception ignored) {
            return fallback;
        }
    }

    @Data
    public static class ConfigFileView {
        private String content;
        private String source;
        private String externalPath;
        private String lastModified;
        private boolean restartRequired;
    }

    @Data
    public static class ValidationResult {
        private boolean valid;
        private List<String> errors;
    }

    @Data
    public static class StructuredConfigView {
        private DtsCustomizationProperties customization;
        private String source;
        private String externalPath;
        private String lastModified;
    }
}
