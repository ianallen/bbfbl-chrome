import * as $ from 'jquery';
import salaries from './salaries';
import * as _ from 'lodash';

$(function() {

    setInterval(render, 600)

    function render() {
        const playerSelector = '.ysf-player-name'
        if ($(".salaried").length > 0) return;
        const $players = $(playerSelector);
        $players.each(function() {
            const $this = $(this);
            const href = $this.find('a').attr('href');
            if (!href) return;
            const playerData = _.find(salaries, { yahoo_id: getId(href) });
            const value = playerData ? playerData.salary17_18 : '$???';
            $this.append(renderSalary(value))
            $this.addClass('salaried');
        })
        const width  = window.location.href.indexOf('players') > 0 ? 220 : 255
        $('td .Ov-h ').css('width', width)
    }
})

function renderSalary(str) {
    const css = {
        'color': '#0d8d40',
        'font-size': 10,
        'font-weight': 500
    }
    const $el = $(`<span>${toDollarFormat(str)}</span>`);
    $el.css(css);
    return $el;
}

function toDollarFormat(str) {
    if (str === '???')
        return str;
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
    });
    return formatter.format(str)
}

function getId(href: string) {
    const fragments = href.split('/');
    return parseInt(fragments[fragments.length - 1])
}

