package com.dts.config;

import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.dts.config.DtsCustomizationProperties;
import com.dts.domain.Product;
import com.dts.domain.ProductModule;
import com.dts.domain.SubModule;
import com.dts.domain.Team;
import com.dts.domain.User;
import com.dts.domain.IssueDomain;
import com.dts.mapper.IssueDomainMapper;
import com.dts.mapper.ModuleMapper;
import com.dts.mapper.ProductMapper;
import com.dts.mapper.ProductVersionMapper;
import com.dts.mapper.SubModuleMapper;
import com.dts.mapper.TeamMapper;
import com.dts.mapper.UserMapper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * DataInitializer「重启覆盖」语义测试：
 * 业务主数据以接入配置为权威来源，配置中缺失的字典应被停用（而非复活）；
 * 组织人员仍按稳定 key 合并，已有账号密码不被覆盖。
 */
class DataInitializerRestartOverrideTest {

    private SubModuleMapper subModuleMapper;
    private ProductMapper productMapper;
    private ModuleMapper moduleMapper;
    private ProductVersionMapper versionMapper;
    private IssueDomainMapper domainMapper;
    private UserMapper userMapper;
    private TeamMapper teamMapper;
    private DataInitializer initializer;

    @BeforeEach
    void setUp() {
        // 单测无 mapper 扫描，需手动初始化实体 TableInfo 供 lambda wrapper 使用
        MybatisConfiguration configuration = new MybatisConfiguration();
        MapperBuilderAssistant assistant = new MapperBuilderAssistant(configuration, "");
        for (Class<?> entity : List.of(SubModule.class, ProductModule.class, Product.class,
                com.dts.domain.ProductVersion.class, IssueDomain.class, User.class, Team.class)) {
            TableInfoHelper.initTableInfo(assistant, entity);
        }
        subModuleMapper = mock(SubModuleMapper.class);
        productMapper = mock(ProductMapper.class);
        moduleMapper = mock(ModuleMapper.class);
        versionMapper = mock(ProductVersionMapper.class);
        domainMapper = mock(IssueDomainMapper.class);
        userMapper = mock(UserMapper.class);
        teamMapper = mock(TeamMapper.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        when(encoder.encode(any())).thenReturn("hash");

        DtsCustomizationProperties customization = new DtsCustomizationProperties();
        DtsCustomizationProperties.MasterData master = customization.getMasterData();
        master.setSubModules(List.of("策略下发"));
        master.setModules(List.of("策略下发"));
        master.setProducts(List.of("态势感知"));
        master.setVersions(List.of("V500R020C10"));
        DtsCustomizationProperties.DomainOption domain = new DtsCustomizationProperties.DomainOption();
        domain.setName("功能缺陷");
        domain.setDescription("描述");
        master.setDomains(List.of(domain));
        DtsCustomizationProperties.TeamOption team = new DtsCustomizationProperties.TeamOption();
        team.setKey("network-security");
        team.setName("网络安全组");
        master.setTeams(List.of(team));
        DtsCustomizationProperties.UserOption leader = new DtsCustomizationProperties.UserOption();
        leader.setEmployeeNo("L0001");
        leader.setUsername("leader");
        leader.setDisplayName("负责人");
        leader.setRole("LEADER");
        leader.setTeam("network-security");
        leader.setSubModule("策略下发");
        leader.setActive(true);
        DtsCustomizationProperties.UserOption dev = new DtsCustomizationProperties.UserOption();
        dev.setEmployeeNo("D1001");
        dev.setUsername("wangwu");
        dev.setDisplayName("王五");
        dev.setRole("DEVELOPER");
        dev.setTeam("network-security");
        dev.setSubModule("策略下发");
        dev.setActive(true);
        master.setUsers(List.of(leader, dev));

        initializer = new DataInitializer(
                userMapper, teamMapper, moduleMapper, productMapper, versionMapper,
                subModuleMapper, domainMapper, encoder, customization);
    }

    private static <T> T withId(T entity, long id) {
        ((com.dts.domain.BaseEntity) entity).setId(id);
        return entity;
    }

    /** 捕获 update(entity, wrapper) 的第二个参数（wrapper），避免对默认方法的 verify 歧义。 */
    @SuppressWarnings({"unchecked", "rawtypes"})
    private <W extends com.baomidou.mybatisplus.core.conditions.AbstractWrapper> AtomicReference<W> captureUpdate(
            com.baomidou.mybatisplus.core.mapper.BaseMapper<?> mapper) {
        AtomicReference<W> ref = new AtomicReference<>();
        doAnswer(invocation -> {
            ref.set((W) invocation.getArgument(1));
            return 1;
        }).when((com.baomidou.mybatisplus.core.mapper.BaseMapper) mapper)
                .update(any(), any());
        return ref;
    }

    private void assertActiveToggle(com.baomidou.mybatisplus.core.conditions.AbstractWrapper<?, ?, ?> wrapper) {
        assertTrue(wrapper.getSqlSet().contains("active"));
        assertTrue(wrapper.getParamNameValuePairs().containsValue(false),
                "重启覆盖应把配置中缺失的字典置为停用");
    }

    @Test
    void deactivatesSubModuleMissingFromConfig() {
        // 库中存在一个配置里没有的激活子模块「流量清洗」→ 应被停用
        when(subModuleMapper.selectOne(any())).thenReturn(withId(SubModule.builder()
                .name("流量清洗").active(true).build(), 2L));

        AtomicReference<UpdateWrapper<SubModule>> ref = captureUpdate(subModuleMapper);
        initializer.run();

        assertActiveToggle(ref.get());
    }

    @Test
    void reactivatesSubModuleReturnedToConfig() {
        // 配置里的「策略下发」在库中处于停用态 → 重启后恢复启用
        when(subModuleMapper.selectOne(any())).thenReturn(withId(SubModule.builder()
                .name("策略下发").active(false).build(), 1L));
        when(moduleMapper.selectOne(any())).thenReturn(withId(ProductModule.builder()
                .name("策略下发").active(true).build(), 1L));

        initializer.run();

        ArgumentCaptor<SubModule> captor = ArgumentCaptor.forClass(SubModule.class);
        verify(subModuleMapper).updateById(captor.capture());
        assertTrue(captor.getValue().getActive());
        assertEquals(1L, captor.getValue().getModuleId());
    }

    @Test
    void deactivatesProductMissingFromConfig() {
        // 库中有一个配置里没有的激活产品 → 应被停用
        when(productMapper.selectOne(any())).thenReturn(withId(Product.builder()
                .name("边界安全").active(true).build(), 1L));

        AtomicReference<UpdateWrapper<Product>> ref = captureUpdate(productMapper);
        initializer.run();

        assertActiveToggle(ref.get());
    }

    @Test
    void mergesExistingUserWithoutOverwritingPassword() {
        // 配置中已存在的用户：更新姓名/角色，但密码保持原样
        User existing = new User();
        existing.setId(10L);
        existing.setUsername("wangwu");
        existing.setPassword("original-password");
        existing.setDisplayName("旧名字");
        when(subModuleMapper.selectOne(any())).thenReturn(withId(SubModule.builder()
                .name("策略下发").active(true).build(), 1L));
        when(moduleMapper.selectOne(any())).thenReturn(withId(ProductModule.builder()
                .name("策略下发").active(true).build(), 1L));
        when(teamMapper.selectOne(any())).thenReturn(withId(Team.builder()
                .name("网络安全组").build(), 1L));
        // leader 与 wangwu 都已存在 → 都走更新，不新建
        when(userMapper.selectOne(any())).thenReturn(existing);

        initializer.run();

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userMapper, times(2)).updateById(captor.capture());
        for (User saved : captor.getAllValues()) {
            assertEquals("original-password", saved.getPassword(), "已有账号密码不能被配置同步覆盖");
            assertEquals(1L, saved.getTeamId());
            assertEquals(1L, saved.getSubModuleId());
        }
    }

    @Test
    void createsNewUserWhenAbsent() {
        when(subModuleMapper.selectOne(any())).thenReturn(withId(SubModule.builder()
                .name("策略下发").active(true).build(), 1L));
        when(moduleMapper.selectOne(any())).thenReturn(withId(ProductModule.builder()
                .name("策略下发").active(true).build(), 1L));
        when(teamMapper.selectOne(any())).thenReturn(withId(Team.builder()
                .name("网络安全组").build(), 1L));
        when(userMapper.selectOne(any())).thenReturn(null); // 所有用户都是新的

        initializer.run();

        verify(userMapper, times(2)).insert(any(User.class));
        verify(userMapper, never()).updateById(any(User.class));
    }

    @Test
    void mergesDomainDescriptionAndDeactivatesMissing() {
        // 配置里的领域「功能缺陷」在库中已有（描述不一致、处于停用）→ 更新描述并恢复启用
        when(domainMapper.selectOne(any())).thenReturn(withId(IssueDomain.builder()
                .name("功能缺陷").description("旧描述").active(false).build(), 1L));

        AtomicReference<UpdateWrapper<IssueDomain>> ref = captureUpdate(domainMapper);
        initializer.run();

        ArgumentCaptor<IssueDomain> captor = ArgumentCaptor.forClass(IssueDomain.class);
        verify(domainMapper).updateById(captor.capture());
        IssueDomain saved = captor.getValue();
        assertEquals("描述", saved.getDescription());
        assertEquals(true, saved.getActive());

        // 配置外领域停用
        assertActiveToggle(ref.get());
    }

    @Test
    void doesNotDeactivateWhenConfigListsAreEmpty() {
        // 空列表（如全新接入还未配置字典）时不应把库清空
        DtsCustomizationProperties customization = new DtsCustomizationProperties();
        DtsCustomizationProperties.MasterData master = customization.getMasterData();
        DtsCustomizationProperties.TeamOption team = new DtsCustomizationProperties.TeamOption();
        team.setKey("t");
        team.setName("团队");
        master.setTeams(List.of(team));
        DataInitializer emptyInitializer = new DataInitializer(
                userMapper, teamMapper, moduleMapper, productMapper, versionMapper,
                subModuleMapper, domainMapper, mock(PasswordEncoder.class), customization);

        emptyInitializer.run();

        verify(subModuleMapper, never()).update(any(), any());
        verify(productMapper, never()).update(any(), any());
    }
}
