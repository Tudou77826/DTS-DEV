package com.dts.controller;

import com.dts.common.ApiResponse;
import com.dts.domain.*;
import com.dts.config.DtsCustomizationProperties;
import com.dts.service.ConfigService;
import com.dts.service.CustomizationAdminService;
import com.dts.service.AdminAccessService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/config")
@RequiredArgsConstructor
public class ConfigController {

    private final ConfigService configService;
    private final CustomizationAdminService customizationAdminService;
    private final AdminAccessService adminAccessService;

    /** 登录前也可读取的系统级接入定制配置（不包含管理员密码哈希）。 */
    @GetMapping("/customization")
    public ApiResponse<DtsCustomizationProperties> customization() {
        return ApiResponse.ok(customizationAdminService.publicView());
    }

    /** 共享管理员密码门禁：校验通过后签发短时管理员令牌。 */
    @PostMapping("/customization/admin/verify")
    public ApiResponse<AdminAccessService.VerifyResponse> verifyAdminPassword(
            @RequestBody AdminPasswordRequest request) {
        return ApiResponse.ok(adminAccessService.verify(request.getPassword()));
    }

    /** 修改共享管理员密码（需要短时管理员令牌；写回配置，重启后生效）。 */
    @PostMapping("/customization/admin/password")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> changeAdminPassword(@RequestBody AdminPasswordRequest request) {
        adminAccessService.changePassword(request.getPassword());
        return ApiResponse.ok();
    }

    @GetMapping("/customization/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<CustomizationAdminService.ConfigFileView> customizationFile() {
        return ApiResponse.ok(customizationAdminService.read());
    }

    @GetMapping("/customization/admin/structured")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<CustomizationAdminService.StructuredConfigView> structuredCustomization() {
        return ApiResponse.ok(customizationAdminService.readStructured());
    }

    @PostMapping("/customization/admin/validate")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<CustomizationAdminService.ValidationResult> validateCustomization(
            @Valid @RequestBody CustomizationContentRequest request) {
        return ApiResponse.ok(customizationAdminService.validate(request.getContent()));
    }

    @PutMapping("/customization/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<CustomizationAdminService.ConfigFileView> saveCustomization(
            @Valid @RequestBody CustomizationContentRequest request) {
        return ApiResponse.ok(customizationAdminService.save(request.getContent()));
    }

    @PutMapping("/customization/admin/structured")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<CustomizationAdminService.ConfigFileView> saveStructuredCustomization(
            @RequestBody DtsCustomizationProperties request) {
        return ApiResponse.ok(customizationAdminService.saveStructured(request));
    }

    /** 一次性获取所有筛选用字典 */
    @GetMapping("/dictionaries")
    public ApiResponse<Map<String, Object>> dictionaries() {
        return ApiResponse.ok(configService.allDictionaries());
    }

    @GetMapping("/users")
    public ApiResponse<List<User>> users() {
        return ApiResponse.ok(configService.listUsers());
    }

    // ─── 产品 ───
    @GetMapping("/products")
    public ApiResponse<List<Product>> products() {
        return ApiResponse.ok(configService.listProducts());
    }

    @PostMapping("/products")
    public ApiResponse<Product> saveProduct(@RequestBody Product p) {
        return ApiResponse.ok(configService.saveProduct(p));
    }

    @DeleteMapping("/products/{id}")
    public ApiResponse<Void> deleteProduct(@PathVariable Long id) {
        configService.deleteProduct(id);
        return ApiResponse.ok();
    }

    // ─── 模块 ───
    @GetMapping("/modules")
    public ApiResponse<List<ProductModule>> modules(@RequestParam(required = false) Long productId) {
        return ApiResponse.ok(configService.listModules(productId));
    }

    @PostMapping("/modules")
    public ApiResponse<ProductModule> saveModule(@RequestBody ProductModule m) {
        return ApiResponse.ok(configService.saveModule(m));
    }

    @DeleteMapping("/modules/{id}")
    public ApiResponse<Void> deleteModule(@PathVariable Long id) {
        configService.deleteModule(id);
        return ApiResponse.ok();
    }

    // ─── 版本 ───
    @GetMapping("/versions")
    public ApiResponse<List<ProductVersion>> versions(@RequestParam(required = false) Long productId) {
        return ApiResponse.ok(configService.listVersions(productId));
    }

    @PostMapping("/versions")
    public ApiResponse<ProductVersion> saveVersion(@RequestBody ProductVersion v) {
        return ApiResponse.ok(configService.saveVersion(v));
    }

    @DeleteMapping("/versions/{id}")
    public ApiResponse<Void> deleteVersion(@PathVariable Long id) {
        configService.deleteVersion(id);
        return ApiResponse.ok();
    }

    // ─── 问题领域 ───
    @GetMapping("/domains")
    public ApiResponse<List<IssueDomain>> domains() {
        return ApiResponse.ok(configService.listDomains());
    }

    @PostMapping("/domains")
    public ApiResponse<IssueDomain> saveDomain(@RequestBody IssueDomain d) {
        return ApiResponse.ok(configService.saveDomain(d));
    }

    @DeleteMapping("/domains/{id}")
    public ApiResponse<Void> deleteDomain(@PathVariable Long id) {
        configService.deleteDomain(id);
        return ApiResponse.ok();
    }

    // ─── 团队 ───
    @GetMapping("/teams")
    public ApiResponse<List<Team>> teams() {
        return ApiResponse.ok(configService.listTeams());
    }

    @PostMapping("/teams")
    public ApiResponse<Team> saveTeam(@RequestBody Team t) {
        return ApiResponse.ok(configService.saveTeam(t));
    }

    @DeleteMapping("/teams/{id}")
    public ApiResponse<Void> deleteTeam(@PathVariable Long id) {
        configService.deleteTeam(id);
        return ApiResponse.ok();
    }

    @Data
    public static class CustomizationContentRequest {
        @NotBlank(message = "配置内容不能为空")
        private String content;
    }

    @Data
    public static class AdminPasswordRequest {
        private String password;
    }
}
