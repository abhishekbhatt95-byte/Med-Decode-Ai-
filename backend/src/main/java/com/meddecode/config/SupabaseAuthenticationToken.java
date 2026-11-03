package com.meddecode.config;

import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Collection;

public class SupabaseAuthenticationToken extends AbstractAuthenticationToken {

    private final SupabaseUserPrincipal principal;
    private final Jwt jwt;

    public SupabaseAuthenticationToken(
        SupabaseUserPrincipal principal,
        Jwt jwt,
        Collection<? extends GrantedAuthority> authorities
    ) {
        super(authorities);
        this.principal = principal;
        this.jwt = jwt;
        setAuthenticated(true);
    }

    @Override
    public Object getCredentials() {
        return jwt.getTokenValue();
    }

    @Override
    public SupabaseUserPrincipal getPrincipal() {
        return principal;
    }

    public Jwt getJwt() {
        return jwt;
    }
}
