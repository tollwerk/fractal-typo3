#!/sbin/openrc-run
# Copyright 2017 Joschi Kuphal <joschi@kuphal.net>
# Distributed under the terms of the MIT license
#
# OpenRC init script for Fractal development servers (http://fractal.build)
#
# To use this script for starting a project specific Fractal development server, follow these steps. The example
# assumes you are using a Gentoo distribution -- paths might differ on your platform.
#
# 1. Place the script into `/etc/init.d`
# 2. Create a symlink to the script, appending a project name separated by a dash, e.g. `/etc/init.d/fractal-myproject`
# 3. Create a service configuration `/etc/conf.d/fractal-myproject` and add define as appropriate
#	 FRACTAL_DIR="/var/www/localhost/fractal"		# Fractal base directory (mandatory)
#    FRACTAL_PORT=3000                              # Fractal server port (optional, defaults to 3000)
#	 FRACTAL_THEME=mytheme							# Custom UI theme (optional, see http://fractal.build/guide/customisation/web-themes)
# 4. Use the script as usual (e.g. `/etc/init.d/fractal-myproject start` resp. `/etc/init.d/fractal-myproject stop`)

set_fractalvars() {
	FRACTALSLOT="${SVCNAME#fractal-}"
	FRACTAL_PID="/var/run/fractal-${FRACTALSLOT}.pid"
	if [ "${FRACTALSLOT}" = "fractal" ] ; then
	    eerror "Please create a project specific init script by symlinking the generic one";
        eerror "Example: /etc/init.d/fractal-myproject"
		exit 1;
	fi

	FRACTAL_CUSTOM_THEME="";
	if [ "${FRACTAL_THEME}" != "" ] ; then
	    FRACTAL_CUSTOM_THEME="--theme ${FRACTAL_THEME}";
	fi;

	FRACTAL_BIN="/usr/bin/fractal";

	if [ ! -d "${FRACTAL_DIR}" ] ; then
        eerror "Please edit /etc/conf.d/fractal-${FRACTALSLOT}"
        eerror "The fractal project directory is invalid"
        return 1
    fi
	return 0
}

start() {
    ebegin "Starting Fractal development server"
    set_fractalvars || return $?

    start-stop-daemon --start \
        --make-pidfile --pidfile "${FRACTAL_PID}" \
        --chdir "${FRACTAL_DIR}" \
        --exec "${FRACTAL_BIN}" \
        --background \
        ${FRACTAL_UMASK:+--umask ${FRACTAL_UMASK}} \
        -- \
        start \
        --port "${FRACTAL_PORT:-3000}" \
        ${FRACTAL_CUSTOM_THEME}
    local i=0
    local timeout=5
    while [ ! -f "${FRACTAL_PID}" ] && [ $i -le $timeout ]; do
        sleep 1
        i=$(($i + 1))
    done

    [ $timeout -gt $i ]
    eend $?
}

stop() {
    ebegin "Stopping Fractal development server"
    set_fractalvars || return $?
    start-stop-daemon --signal QUIT \
        --stop \
        --exec "${FRACTAL_BIN}" \
        --pidfile "${FRACTAL_PID}"
    eend $?
}

reload() {
    configtest || return $?
    ebegin "Reloading Fractal development server"
    set_fractalvars || return $?
    [ -f "${FRACTAL_PID}" ] && kill -USR2 $(cat "${FRACTAL_PID}")
    eend $?
}
