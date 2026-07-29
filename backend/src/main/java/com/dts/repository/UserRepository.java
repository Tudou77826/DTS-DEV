package com.dts.repository;

import com.dts.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmployeeNo(String employeeNo);

    List<User> findByRoleAndActiveTrue(String role);

    List<User> findByActiveTrue();
}
