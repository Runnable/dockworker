(function ($) {
    change_idle('Initial');

    $( document ).on( "idle.idleTimer", function(event, elem, obj){
        change_idle('idle');
    });

    $( document ).on( "active.idleTimer", function(event, elem, obj, triggerevent){
        change_idle('active');
    });

    function change_idle(idle_state){
        idle_status=idle_state;
    };

    $.idleTimer(3000);

    respondToIdleStatus = function(e) {
        // if (e.origin == '*') {
            // e.data is the string sent by the origin with postMessage. 
            if (e.data == 'ruidle?') {
                parent.postMessage('idle_status:' + idle_status, '*');
            }
        // }
    }

    window.addEventListener('message', respondToIdleStatus, false);
    
})(jQuery);
