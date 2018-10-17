import * as $ from 'jquery';
import salaries from './salaries';
import * as _ from 'lodash';



$(function() {
    setInterval(render, 600)
    const playerSelector = '.ysf-player-name';
    const salariedSelector = ".bbfbl-salaried";    

    function rendered() {
        return $(".bbfbl-salaried").length > 0;
    }

    function render() {
        const rendered = $(salariedSelector).length >  0;
        var val = $(salariedSelector)
        if (rendered) return;
        const $players = $(playerSelector);
        const teamSalaries = [];

        $players.each(function() {
            const $this = $(this);
            const href = $this.find('a').attr('href');

            if (!href) return;
            const playerData = _.find(salaries, { yahoo_id: getId(href) });
            const value = playerData ? playerData.salary18_19 : 0;
            $this.append(renderSalary(value))
            $this.addClass('bbfbl-salaried');
            teamSalaries.push(value);
        })
        const hasSalaryDisplayed = $("#team-card-info .bbfbl-total-salary").length > 0;
        if (!hasSalaryDisplayed) {
            const totalSalary = sum(teamSalaries);
            renderTotalSalary(totalSalary);
        }
        const width  = window.location.href.indexOf('players') > 0 ? 220 : 255
        $('td .Ov-h ').css('width', width)
    }

    function sum(values: number[]) {
        return values.reduce((total, salary) => { return total + salary}, 0);
    }
    function renderTotalSalary(total: number) {
        const color = total < 130000000 ? '#0d8d40' : '#f33131'
        const css = {
            'color': color,
            'font-size': 10,
            'font-weight': 500
        }
        const elem = $(`<span class='bbfbl-total-salary'>${toDollarFormat(total)}</span>`);
        elem.css(css);
        $('#team-card-info .Pstart-lg li')
        .append(elem);
    }
    
    function renderSalaryTable(playerid: number, salary: number) {
        console.log(playerid)
        const container = $(`#playernote-LDRB-${playerid}`);
        console.log(container)
        if (container.length == 1) {
            const elem = $('<li>' + renderSalary(salary) + '</li>')
            container.append(elem)
        }
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

